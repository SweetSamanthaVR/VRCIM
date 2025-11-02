import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { VRChatDatabase } from './database';
import { 
    AuthResult, 
    TwoFactorAuthResult, 
    VRChatLoginResponse,
    VRChatVerify2FAResponse,
    VRChatCurrentUserResponse,
    getErrorMessage 
} from './types';
import { logger } from './logger';

/**
 * Authentication credentials for VRChat API login
 */
export interface AuthCredentials {
  username: string;
  password: string;
}

/**
 * Current authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  authToken?: string;
  authCookie?: string;
  twoFactorCookie?: string;
  username?: string;
  userId?: string;
  requires2FA?: boolean;
  lastValidated?: Date;
  validationFailures?: number;
}

/**
 * Service for managing VRChat API authentication
 * Handles login, 2FA verification, token validation, and session persistence
 */
export class VRChatAuthService {
  private authState: AuthState = {
    isAuthenticated: false,
  };
  private database: VRChatDatabase;
  private validationIntervalId?: NodeJS.Timeout;
  private readonly VALIDATION_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_VALIDATION_FAILURES = 3;
  private readonly TOKEN_STALE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours

  constructor(database: VRChatDatabase) {
    this.database = database;
  }

  /**
   * Initialize authentication service and load existing session from database
   * Validates stored token if it's stale and starts periodic validation
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    try {
      // Try to load existing auth state from database
      const savedAuth = this.database.getAuthSession();

      if (savedAuth) {
        this.authState = {
          isAuthenticated: Boolean(savedAuth.is_authenticated),
          authCookie: savedAuth.auth_cookie || undefined,
          twoFactorCookie: savedAuth.two_factor_cookie || undefined,
          username: savedAuth.username || undefined,
          userId: savedAuth.user_id || undefined,
          requires2FA: false,
          lastValidated: savedAuth.last_validated ? new Date(savedAuth.last_validated) : undefined,
          validationFailures: savedAuth.validation_failures || 0,
        };

        logger.info('✓ Loaded existing VRChat authentication');

        // Check if token needs validation
        const needsValidation = this.shouldValidateToken();
        
        if (needsValidation) {
          logger.info('→ Validating stored authentication token...');
          const isValid = await this.verifyAndUpdateAuth();
          if (!isValid) {
            logger.info('⚠ Stored authentication is invalid or expired, clearing');
            await this.clearAuth();
          } else {
            logger.info('✓ Authentication token validated successfully');
          }
        }

        // Start periodic validation if authenticated
        if (this.authState.isAuthenticated) {
          this.startPeriodicValidation();
        }
      } else {
        logger.info('ℹ No valid authentication found. Please log in via /login');
      }
    } catch (error) {
      logger.info('ℹ No existing auth state found');
    }
  }

  /**
   * Authenticate with VRChat API using username and password
   * @param credentials - Username and password for VRChat account
   * @returns Object indicating success, whether 2FA is required, and any error message
   */
  async login(credentials: AuthCredentials): Promise<{ success: boolean; requires2FA?: boolean; error?: string }> {
    try {
      logger.info(`→ Attempting to authenticate user: ${credentials.username}`);

      const authHeader = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');

      const response = await axios.get('https://api.vrchat.cloud/api/1/auth/user', {
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'VRCIM/1.0',
        },
        validateStatus: () => true, // Don't throw on any status
      });

      const setCookieHeader = response.headers['set-cookie'];

      if (response.status === 200) {
        const data = response.data as VRChatLoginResponse;

        // Check if 2FA is required
        if (data.requiresTwoFactorAuth && data.requiresTwoFactorAuth.length > 0) {
          logger.info('→ Two-factor authentication required');

          // Store temporary auth cookie for 2FA verification
          if (setCookieHeader) {
            this.authState.authCookie = this.parseSetCookieHeader(setCookieHeader);
          }

          this.authState.requires2FA = true;
          this.authState.username = credentials.username;

          return { success: false, requires2FA: true };
        }

        // No 2FA required, authentication successful
        if (setCookieHeader) {
          this.authState.authCookie = this.parseSetCookieHeader(setCookieHeader);
        }

        this.authState.isAuthenticated = true;
        this.authState.username = data.username || credentials.username;
        this.authState.userId = data.id;
        this.authState.requires2FA = false;
        this.authState.lastValidated = new Date();
        this.authState.validationFailures = 0;

        await this.saveAuthState();
        this.startPeriodicValidation();
        logger.info('✓ Successfully authenticated with VRChat API');

        return { success: true };
      } else if (response.status === 401) {
        logger.error('✗ Invalid credentials');
        return { success: false, error: 'Invalid username or password' };
      } else {
        logger.error(`✗ Authentication failed: ${response.status} - ${response.statusText}`);
        return { success: false, error: `Authentication failed: ${response.status}` };
      }
    } catch (error) {
      logger.error('✗ Login error:', error);
      return { success: false, error: 'Network error during login' };
    }
  }

  /**
   * Verify two-factor authentication code
   * @param code - 6-digit TOTP code from authenticator app
   * @returns Object indicating success and any error message
   */
  async verify2FA(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.authState.authCookie) {
        return { success: false, error: 'No authentication session found. Please log in again.' };
      }

      logger.info('→ Verifying 2FA code');

      const response = await axios.post('https://api.vrchat.cloud/api/1/auth/twofactorauth/totp/verify',
        { code },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': this.authState.authCookie,
            'User-Agent': 'VRCIM/1.0',
          },
          validateStatus: () => true,
        }
      );

      if (response.status === 200) {
        const setCookieHeader = response.headers['set-cookie'];

        if (setCookieHeader) {
          // Merge new cookies with existing ones
          const newCookies = this.parseSetCookieHeader(setCookieHeader);
          const existingCookies = this.authState.authCookie || '';

          // Combine cookies, avoiding duplicates
          const cookieMap = new Map<string, string>();

          // Parse existing cookies
          if (existingCookies) {
            existingCookies.split(';').forEach(cookie => {
              const trimmed = cookie.trim();
              const [name] = trimmed.split('=');
              if (name) cookieMap.set(name, trimmed);
            });
          }

          // Parse and add new cookies (will overwrite if key exists)
          if (newCookies) {
            newCookies.split(';').forEach(cookie => {
              const trimmed = cookie.trim();
              const [name] = trimmed.split('=');
              if (name) cookieMap.set(name, trimmed);
            });
          }

          // Combine all cookies
          this.authState.authCookie = Array.from(cookieMap.values()).join('; ');

          const twoFactorCookie = this.extractTwoFactorCookieFromArray(setCookieHeader);
          if (twoFactorCookie) {
            this.authState.twoFactorCookie = twoFactorCookie;
          }
        }

        this.authState.isAuthenticated = true;
        this.authState.requires2FA = false;
        this.authState.lastValidated = new Date();
        this.authState.validationFailures = 0;

        // Get user info after successful 2FA
        const userInfo = await this.getCurrentUser();
        if (userInfo) {
          this.authState.userId = userInfo.id;
          this.authState.username = userInfo.username;
        }

        await this.saveAuthState();
        this.startPeriodicValidation();
        logger.info('✓ Successfully verified 2FA and authenticated');
        
        return { success: true };
      } else if (response.status === 401) {
        logger.error('✗ Invalid 2FA code');
        return { success: false, error: 'Invalid verification code' };
      } else {
        logger.error(`✗ 2FA verification failed: ${response.status} - ${response.statusText}`);
        return { success: false, error: `Verification failed: ${response.status}` };
      }
    } catch (error) {
      logger.error('✗ 2FA verification error:', error);
      return { success: false, error: 'Network error during verification' };
    }
  }

  /**
   * Verify if current authentication is still valid with VRChat API
   * @returns True if authentication is valid, false otherwise
   */
  async verifyAuth(): Promise<boolean> {
    try {
      if (!this.authState.authCookie) {
        return false;
      }

      const response = await axios.get('https://api.vrchat.cloud/api/1/auth/user', {
        headers: {
          'Cookie': this.authState.authCookie,
          'User-Agent': 'VRCIM/1.0',
        },
        validateStatus: () => true,
      });

      return response.status === 200;
    } catch (error) {
      logger.error('✗ Auth verification error:', error);
      return false;
    }
  }

  /**
   * Get current user information from VRChat API
   * @returns User data object or null if not authenticated or request fails
   */
  async getCurrentUser(): Promise<any> {
    try {
      if (!this.authState.authCookie) {
        return null;
      }

      const response = await axios.get('https://api.vrchat.cloud/api/1/auth/user', {
        headers: {
          'Cookie': this.authState.authCookie,
          'User-Agent': 'VRCIM/1.0',
        },
        validateStatus: () => true,
      });

      if (response.status === 200) {
        return response.data;
      }
      return null;
    } catch (error) {
      logger.error('✗ Get current user error:', error);
      return null;
    }
  }

  /**
   * Clear authentication state and remove from database
   * Stops periodic validation and resets all auth data
   * @returns Promise that resolves when auth is cleared
   */
  async clearAuth(): Promise<void> {
    this.stopPeriodicValidation();
    
    this.authState = {
      isAuthenticated: false,
    };

    this.database.clearAuthSession();
    logger.info('✓ Authentication cleared');
  }

  /**
   * Get a copy of the current authentication state
   * @returns Copy of AuthState object
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Get the authentication cookie string
   * @returns Auth cookie string or undefined if not authenticated
   */
  getAuthCookie(): string | undefined {
    return this.authState.authCookie;
  }

  /**
   * Check if user is currently authenticated
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  private parseSetCookieHeader(setCookieArray: string[]): string {
    const cookies: string[] = [];

    for (const cookieStr of setCookieArray) {
      const parts = cookieStr.split(';')[0]; // Get just the name=value part
      if (parts.includes('auth=') || parts.includes('apiKey=') || parts.includes('twoFactorAuth=')) {
        cookies.push(parts);
      }
    }

    return cookies.join('; ');
  }

  private extractTwoFactorCookieFromArray(setCookieArray: string[]): string | undefined {
    for (const cookieStr of setCookieArray) {
      const parts = cookieStr.split(';')[0];
      if (parts.includes('twoFactorAuth=')) {
        return parts;
      }
    }
    return undefined;
  }

  private async saveAuthState(): Promise<void> {
    try {
      this.database.saveAuthSession({
        isAuthenticated: this.authState.isAuthenticated,
        authCookie: this.authState.authCookie || null,
        twoFactorCookie: this.authState.twoFactorCookie || null,
        username: this.authState.username || null,
        userId: this.authState.userId || null,
        lastValidated: this.authState.lastValidated?.toISOString() || null,
        validationFailures: this.authState.validationFailures || 0,
      });

      logger.info('✓ Auth state saved to database');
    } catch (error) {
      logger.error('✗ Failed to save auth state:', error);
    }
  }

  /**
   * Check if the authentication token needs validation
   * Returns true if:
   * - Never validated before
   * - Last validation was more than TOKEN_STALE_THRESHOLD ago
   * - Has validation failures
   */
  private shouldValidateToken(): boolean {
    if (!this.authState.isAuthenticated || !this.authState.authCookie) {
      return false;
    }

    // Never validated before
    if (!this.authState.lastValidated) {
      return true;
    }

    // Check if token is stale (last validated more than 2 hours ago)
    const timeSinceValidation = Date.now() - this.authState.lastValidated.getTime();
    if (timeSinceValidation > this.TOKEN_STALE_THRESHOLD) {
      return true;
    }

    // Has validation failures
    if (this.authState.validationFailures && this.authState.validationFailures > 0) {
      return true;
    }

    return false;
  }

  /**
   * Verify authentication and update validation tracking
   * Updates lastValidated and validationFailures based on result
   */
  private async verifyAndUpdateAuth(): Promise<boolean> {
    try {
      if (!this.authState.authCookie) {
        return false;
      }

      const response = await axios.get('https://api.vrchat.cloud/api/1/auth/user', {
        headers: {
          'Cookie': this.authState.authCookie,
          'User-Agent': 'VRCIM/1.0',
        },
        validateStatus: () => true,
        timeout: 10000, // 10 second timeout
      });

      const isValid = response.status === 200;

      if (isValid) {
        // Successful validation - reset failures and update timestamp
        this.authState.lastValidated = new Date();
        this.authState.validationFailures = 0;
        await this.saveAuthState();
        return true;
      } else {
        // Validation failed - increment failures
        this.authState.validationFailures = (this.authState.validationFailures || 0) + 1;
        
        // If max failures reached, clear auth
        if (this.authState.validationFailures >= this.MAX_VALIDATION_FAILURES) {
          logger.error(`✗ Authentication validation failed ${this.MAX_VALIDATION_FAILURES} times, clearing session`);
          await this.clearAuth();
          return false;
        }

        await this.saveAuthState();
        logger.warn(`⚠ Authentication validation failed (${this.authState.validationFailures}/${this.MAX_VALIDATION_FAILURES})`);
        return false;
      }
    } catch (error) {
      logger.error('✗ Auth verification error:', error);
      
      // Network errors don't count as validation failures
      // Just log the error and return false
      return false;
    }
  }

  /**
   * Start periodic validation of authentication token
   * Runs every VALIDATION_INTERVAL (30 minutes) to ensure token is still valid
   */
  private startPeriodicValidation(): void {
    // Clear any existing interval
    if (this.validationIntervalId) {
      clearInterval(this.validationIntervalId);
    }

    // Start new interval
    this.validationIntervalId = setInterval(async () => {
      if (this.authState.isAuthenticated && this.authState.authCookie) {
        logger.info('→ Performing periodic authentication validation...');
        const isValid = await this.verifyAndUpdateAuth();
        
        if (isValid) {
          logger.info('✓ Periodic validation successful');
        } else {
          logger.warn('⚠ Periodic validation failed');
        }
      }
    }, this.VALIDATION_INTERVAL);

    logger.info(`✓ Started periodic authentication validation (every ${this.VALIDATION_INTERVAL / 60000} minutes)`);
  }

  /**
   * Stop periodic validation
   */
  private stopPeriodicValidation(): void {
    if (this.validationIntervalId) {
      clearInterval(this.validationIntervalId);
      this.validationIntervalId = undefined;
      logger.info('✓ Stopped periodic authentication validation');
    }
  }

  /**
   * Get authentication cookie with automatic validation
   * Ensures the token is valid before returning it
   */
  async getValidatedAuthCookie(): Promise<string | undefined> {
    if (!this.authState.isAuthenticated || !this.authState.authCookie) {
      return undefined;
    }

    // Check if we need to validate
    if (this.shouldValidateToken()) {
      logger.info('→ Token needs validation before use...');
      const isValid = await this.verifyAndUpdateAuth();
      
      if (!isValid) {
        logger.warn('⚠ Token validation failed, clearing authentication');
        await this.clearAuth();
        return undefined;
      }
    }

    return this.authState.authCookie;
  }
}
