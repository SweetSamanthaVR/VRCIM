/**
 * Configuration Management System
 * Loads configuration from environment variables with sensible defaults
 * Supports .env files via dotenv package
 */

import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';

/**
 * Application configuration interface
 */
export interface AppConfig {
    // Server Configuration
    port: number;
    host: string;
    nodeEnv: string;
    
    // Database Configuration
    databasePath: string;
    
    // VRChat Configuration
    vrchatLogPath: string;
    
    // VR Notification Configuration
    ovrToolkitEnabled: boolean;
    xsOverlayEnabled: boolean;
    
    // WebSocket Configuration (for frontend)
    wsProtocol: string;
    wsHost: string;
    wsPort: number;
    
    // Pagination Configuration
    playersPerPage: number;
    recentActivityLimit: number;
    cachedUsersPerPage: number;
    
    // Browser Configuration
    autoOpenBrowser: boolean;
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): AppConfig {
    // Try to load .env file if it exists (for local development)
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        logger.info('📄 Loading configuration from .env file');
        // Parse .env file manually (avoiding external dependency)
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    // Only set if not already in environment
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
        });
    }
    
    // Server Configuration
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || 'localhost';
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Database configuration
    const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'vrcim.db');
    
    // VRChat Configuration
    let vrchatLogPath: string;
    if (process.env.VRCHAT_LOG_PATH) {
        vrchatLogPath = process.env.VRCHAT_LOG_PATH;
    } else {
        // Default path for Windows
        const userProfile = process.env.USERPROFILE || process.env.HOME || '';
        vrchatLogPath = path.join(userProfile, 'AppData', 'LocalLow', 'VRChat', 'VRChat');
    }
    
    // VR Notification Configuration
    const ovrToolkitEnabled = process.env.OVRTOOLKIT_ENABLED !== 'false'; // Default: true
    const xsOverlayEnabled = process.env.XSOVERLAY_ENABLED !== 'false';   // Default: true
    
    // WebSocket Configuration
    const wsProtocol = process.env.WS_PROTOCOL || (nodeEnv === 'production' ? 'wss' : 'ws');
    const wsHost = process.env.WS_HOST || host;
    const wsPort = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : port;
    
    // Pagination Configuration
    const playersPerPage = Math.min(Math.max(parseInt(process.env.PLAYERS_PER_PAGE || '20'), 1), 200);
    const recentActivityLimit = Math.min(Math.max(parseInt(process.env.RECENT_ACTIVITY_LIMIT || '50'), 1), 1000);
    const cachedUsersPerPage = Math.min(Math.max(parseInt(process.env.CACHED_USERS_PER_PAGE || '50'), 1), 500);
    
    // Browser Configuration
    const autoOpenBrowser = process.env.AUTO_OPEN_BROWSER !== 'false'; // Default: true
    
    return {
        port,
        host,
        nodeEnv,
        databasePath,
        vrchatLogPath,
        ovrToolkitEnabled,
        xsOverlayEnabled,
        wsProtocol,
        wsHost,
        wsPort,
        playersPerPage,
        recentActivityLimit,
        cachedUsersPerPage,
        autoOpenBrowser
    };
}

/**
 * Validate configuration values
 */
function validateConfig(config: AppConfig): void {
    const errors: string[] = [];
    
    // Validate port
    if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
        errors.push(`Invalid PORT: ${config.port}. Must be between 1 and 65535.`);
    }
    
    // Validate database path
    if (!config.databasePath) {
        errors.push('DATABASE_PATH is required.');
    }
    
    // Validate VRChat log path
    if (!config.vrchatLogPath) {
        errors.push('VRCHAT_LOG_PATH is required.');
    }
    
    // Validate host
    if (!config.host) {
        errors.push('HOST is required.');
    }
    
    if (errors.length > 0) {
        logger.error('❌ Configuration validation failed:');
        errors.forEach(error => logger.error(`   - ${error}`));
        throw new Error('Invalid configuration');
    }
}

/**
 * Display current configuration (for debugging)
 */
function displayConfig(config: AppConfig): void {
    logger.info('⚙️  Application Configuration:');
    logger.info(`   Environment: ${config.nodeEnv}`);
    logger.info(`   Server: http://${config.host}:${config.port}`);
    logger.info(`   WebSocket: ${config.wsProtocol}://${config.wsHost}:${config.wsPort}`);
    logger.info(`   Database: ${config.databasePath}`);
    logger.info(`   VRChat Logs: ${config.vrchatLogPath}`);
    logger.info(`   OVR Toolkit: ${config.ovrToolkitEnabled ? 'Enabled' : 'Disabled'}`);
    logger.info(`   XSOverlay: ${config.xsOverlayEnabled ? 'Enabled' : 'Disabled'}`);
    logger.info(`   Log Level: ${logger.getLevelName()}`);
    logger.info(`   Players Per Page: ${config.playersPerPage}`);
    logger.info(`   Recent Activity Limit: ${config.recentActivityLimit}`);
    logger.info(`   Cached Users Per Page: ${config.cachedUsersPerPage}`);
    logger.info(`   Auto-Open Browser: ${config.autoOpenBrowser ? 'Enabled' : 'Disabled'}`);
}

// Load configuration once at module initialization
const config = loadConfig();
validateConfig(config);

// Display configuration in development mode
if (config.nodeEnv === 'development') {
    displayConfig(config);
}

// Export the singleton configuration instance
export default config;

/**
 * Get the full server URL
 */
export function getServerUrl(): string {
    const protocol = config.nodeEnv === 'production' ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
}

/**
 * Get the full WebSocket URL
 * Returns 'auto' to allow frontend to dynamically detect protocol and host
 * This ensures WebSocket connections work correctly in all scenarios:
 * - HTTP/HTTPS detection from browser
 * - Localhost/IP/hostname detection from browser URL
 * - Works in both development and production modes
 */
export function getWebSocketUrl(): string {
    // Always return 'auto' unless WS_PROTOCOL is explicitly set
    // This allows the frontend to intelligently detect:
    // 1. Protocol: ws for http://, wss for https://
    // 2. Host: Same as the page URL (localhost, IP, or hostname)
    const isExplicitWsProtocol = process.env.WS_PROTOCOL !== undefined;
    const isExplicitWsHost = process.env.WS_HOST !== undefined;
    
    if (isExplicitWsProtocol || isExplicitWsHost) {
        // User has explicitly configured WebSocket settings, use them
        return `${config.wsProtocol}://${config.wsHost}:${config.wsPort}`;
    } else {
        // Return 'auto' to signal frontend to auto-detect everything
        return 'auto';
    }
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
    return config.nodeEnv === 'production';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
    return config.nodeEnv === 'development';
}
