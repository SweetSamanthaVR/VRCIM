/**
 * Localization Service
 * Handles loading and serving translations
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface Translations {
    [key: string]: string | Translations;
}

export class LocalizationService {
    private translations: Map<string, Translations> = new Map();
    private defaultLanguage: string = 'en';
    private languagesDir: string;

    constructor(languagesDir?: string) {
        this.languagesDir = languagesDir || path.join(process.cwd(), 'languages');
        this.loadTranslations();
    }

    /**
     * Load all translation files from the languages directory
     */
    private loadTranslations(): void {
        try {
            if (!fs.existsSync(this.languagesDir)) {
                logger.warn(`⚠ Languages directory not found: ${this.languagesDir}`);
                fs.mkdirSync(this.languagesDir, { recursive: true });
                this.createDefaultLanguageFile();
                return;
            }

            const files = fs.readdirSync(this.languagesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            if (jsonFiles.length === 0) {
                logger.warn('⚠ No language files found, creating default English file');
                this.createDefaultLanguageFile();
            }

            for (const file of jsonFiles) {
                const langCode = path.basename(file, '.json');
                const filePath = path.join(this.languagesDir, file);
                
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const translations = JSON.parse(content);
                    this.translations.set(langCode, translations);
                    logger.info(`📝 Loaded language: ${langCode} (${translations._meta?.name || langCode})`);
                } catch (error) {
                    logger.error(`❌ Failed to load language file ${file}:`, error);
                }
            }

            if (!this.translations.has(this.defaultLanguage)) {
                logger.warn(`⚠ Default language '${this.defaultLanguage}' not found, creating it`);
                this.createDefaultLanguageFile();
            }
        } catch (error) {
            logger.error('❌ Failed to load translations:', error);
        }
    }

    /**
     * Create default English language file
     */
    private createDefaultLanguageFile(): void {
        const defaultTranslations = this.getDefaultEnglishTranslations();
        const filePath = path.join(this.languagesDir, 'en.json');
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(defaultTranslations, null, 2), 'utf-8');
            this.translations.set('en', defaultTranslations);
            logger.info('✅ Created default English language file');
        } catch (error) {
            logger.error('❌ Failed to create default language file:', error);
        }
    }

    /**
     * Get default English translations
     */
    private getDefaultEnglishTranslations(): Translations {
        return {
            "_meta": {
                "name": "English",
                "code": "en",
                "contributors": "VRCIM Team"
            },
            "common": {
                "appName": "VRChat Instance Monitor",
                "loading": "Loading...",
                "error": "Error",
                "success": "Success",
                "cancel": "Cancel",
                "save": "Save",
                "close": "Close",
                "confirm": "Confirm",
                "delete": "Delete",
                "edit": "Edit",
                "refresh": "Refresh",
                "search": "Search",
                "filter": "Filter",
                "clear": "Clear",
                "noData": "No data available",
                "clickToDismiss": "Click to dismiss"
            },
            "nav": {
                "monitor": "Monitor",
                "users": "Users",
                "login": "Login",
                "logout": "Logout"
            },
            "monitor": {
                "title": "VRChat Instance Monitor",
                "currentWorld": "Current World",
                "playersInWorld": "Players in World",
                "apiQueue": "API Queue",
                "sessionPlaytime": "Session Playtime",
                "currentSession": "Current Session",
                "connectionStatus": "Connection Status",
                "connected": "Connected",
                "disconnected": "Disconnected",
                "playersInInstance": "Players in Instance",
                "recentActivity": "Recent Activity",
                "notificationsOn": "Notifications On",
                "notificationsPaused": "Notifications Paused",
                "noPlayers": "No players in current instance",
                "waitingForVRChat": "Waiting for VRChat to start...",
                "perUser": "per user",
                "worldEvents": "World Events",
                "playerEvents": "Player Events",
                "noLogsAvailable": "No logs available",
                "vrchatNotRunning": "VRChat is not currently running",
                "trustRank": {
                    "visitor": "Visitor",
                    "newUser": "New User",
                    "user": "User",
                    "knownUser": "Known User",
                    "trustedUser": "Trusted User",
                    "veteranUser": "Veteran User",
                    "legendaryUser": "Legendary User"
                },
                "events": {
                    "joiningWorld": "Joining World",
                    "onPlayerJoined": "Player Joined",
                    "onPlayerLeft": "Player Left"
                },
                "pagination": {
                    "previous": "← Previous",
                    "next": "Next →",
                    "page": "Page {{current}}"
                }
            },
            "users": {
                "title": "Cached Users",
                "subtitle": "All VRChat users you've encountered",
                "totalCachedUsers": "Total Cached Users",
                "searchPlaceholder": "Search by username or display name...",
                "filterByRank": "Filter by Rank",
                "allUsers": "All Users",
                "visitors": "Visitors",
                "newUsers": "New Users",
                "users": "Users",
                "knownUsers": "Known Users",
                "trustedUsers": "Trusted Users",
                "veteranUsers": "Veteran Users",
                "legendaryUsers": "Legendary Users",
                "firstSeen": "First Seen",
                "lastUpdated": "Last Updated",
                "timesEncountered": "Times Encountered",
                "viewProfile": "View Profile",
                "noUsersFound": "No users found matching your criteria",
                "clearFilters": "Clear filters to see all users"
            },
            "userDetails": {
                "title": "User Profile",
                "backToUsers": "← Back to Users",
                "refreshProfile": "Refresh Profile",
                "refreshing": "Refreshing...",
                "biography": "Biography",
                "bioLinks": "Bio Links",
                "statusMessage": "Status Message",
                "accountInfo": "Account Information",
                "username": "Username",
                "displayName": "Display Name",
                "trustRank": "Trust Rank",
                "accountStatus": "Account Status",
                "lastLogin": "Last Login",
                "lastPlatform": "Last Platform",
                "encounterHistory": "Encounter History",
                "worldName": "World Name",
                "timestamp": "Timestamp",
                "sessionId": "Session ID",
                "noEncounters": "No encounter history available",
                "friend": "Friend",
                "notFriend": "Not a Friend",
                "online": "Online",
                "offline": "Offline",
                "active": "Active",
                "busy": "Busy",
                "askMe": "Ask Me",
                "joinMe": "Join Me"
            },
            "login": {
                "title": "Login to VRChat",
                "description": "Authenticate with VRChat to enable user profile fetching",
                "username": "Username",
                "password": "Password",
                "twoFactorCode": "2FA Code (if enabled)",
                "loginButton": "Login to VRChat",
                "loggingIn": "Logging in...",
                "verifying2FA": "Verifying 2FA...",
                "logoutButton": "Logout",
                "authenticationStatus": "Authentication Status",
                "authenticated": "Authenticated",
                "notAuthenticated": "Not Authenticated",
                "requiresAuth": "Authentication required to use VRChat API features",
                "twoFactorRequired": "Two-Factor Authentication Required",
                "enterCode": "Enter your 2FA code from your authenticator app",
                "verify": "Verify",
                "cancel": "Cancel"
            },
            "errors": {
                "networkError": "Network error occurred",
                "serverError": "Server error occurred",
                "authFailed": "Authentication failed",
                "invalidCredentials": "Invalid username or password",
                "twoFactorFailed": "2FA verification failed",
                "userNotFound": "User not found",
                "sessionExpired": "Session expired, please login again",
                "unknownError": "An unknown error occurred"
            },
            "success": {
                "loginSuccess": "Successfully logged in",
                "logoutSuccess": "Successfully logged out",
                "profileRefreshed": "Profile refreshed successfully",
                "settingsSaved": "Settings saved successfully"
            }
        };
    }

    /**
     * Get translations for a specific language
     * Falls back to default language if not found
     */
    getTranslations(langCode: string): Translations {
        if (this.translations.has(langCode)) {
            return this.translations.get(langCode)!;
        }
        
        // Try language without region (e.g., 'en' from 'en-US')
        const baseLanguage = langCode.split('-')[0];
        if (this.translations.has(baseLanguage)) {
            return this.translations.get(baseLanguage)!;
        }
        
        // Fallback to default language
        return this.translations.get(this.defaultLanguage) || {};
    }

    /**
     * Get list of available languages
     */
    getAvailableLanguages(): Array<{ code: string; name: string }> {
        const languages: Array<{ code: string; name: string }> = [];
        
        this.translations.forEach((translations, code) => {
            const meta = translations._meta as any;
            languages.push({
                code,
                name: meta?.name || code.toUpperCase()
            });
        });
        
        return languages.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Detect language from Accept-Language header
     */
    detectLanguage(acceptLanguageHeader?: string): string {
        if (!acceptLanguageHeader) {
            return this.defaultLanguage;
        }

        // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
        const languages = acceptLanguageHeader
            .split(',')
            .map(lang => {
                const parts = lang.trim().split(';');
                const code = parts[0];
                const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
                return { code, quality };
            })
            .sort((a, b) => b.quality - a.quality);

        // Try to find a matching language
        for (const { code } of languages) {
            if (this.translations.has(code)) {
                return code;
            }
            
            // Try base language
            const baseCode = code.split('-')[0];
            if (this.translations.has(baseCode)) {
                return baseCode;
            }
        }

        return this.defaultLanguage;
    }

    /**
     * Reload translations from disk
     */
    reload(): void {
        this.translations.clear();
        this.loadTranslations();
    }
}

// Export singleton instance
export const localizationService = new LocalizationService();