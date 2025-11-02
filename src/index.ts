/**
 * VRChat Instance Monitor - Application Entry Point
 * 
 * Main initialization file that:
 * - Loads configuration from environment
 * - Creates database connection
 * - Initializes VRChat API authentication
 * - Starts web server
 * - Initializes VRChat monitor
 * - Handles graceful shutdown
 */

import config, { getServerUrl } from './config';
import { VRChatDatabase } from './database';
import { WebServer } from './webserver';
import { VRChatMonitor } from './monitor';
import { VRChatAuthService } from './auth';
import { VRChatAPIClient } from './vrchatApiClient';
import { logger } from './logger';

// ============================================================================
// Application Entry Point
// ============================================================================

/**
 * Initialize database
 * Database path is loaded from configuration
 */
const database = new VRChatDatabase(config.databasePath);

/**
 * Initialize VRChat API authentication service
 */
const authService = new VRChatAuthService(database);

/**
 * Initialize web server and pass auth service
 */
const webServer = new WebServer(database);
webServer.setAuthService(authService);
webServer.start();

/**
 * Initialize VRChat API client for user data fetching
 */
const apiClient = new VRChatAPIClient(authService, webServer);

/**
 * Set API client on web server for manual refresh functionality
 */
webServer.setAPIClient(apiClient);

// Initialize auth service asynchronously
(async () => {
    try {
        await authService.initialize();
        logger.info('🔐 Authentication service initialized');
        
        if (authService.isAuthenticated()) {
            logger.info('✓ Already authenticated with VRChat API');
            logger.info('✓ User profile fetching enabled (1 second rate limit, 60/min)');
        } else {
            logger.info(`ℹ To use VRChat API features, please login at ${getServerUrl()}/login`);
        }
    } catch (error) {
        logger.error('⚠ Failed to initialize auth service:', error);
    }
})();

/**
 * Create and initialize the VRChat monitor instance.
 * This starts all monitoring activities including:
 * - VRChat process detection
 * - Log file watching
 * - World event parsing
 * - Player event tracking
 * - User profile fetching (if authenticated)
 */
const monitor = new VRChatMonitor(database, webServer, apiClient);
webServer.setMonitor(monitor); // Set monitor for notification control
monitor.start();

/**
 * Handle graceful shutdown when user presses Ctrl+C.
 * Ensures all resources are properly cleaned up before exit.
 * 
 * SIGINT is the signal sent when user presses Ctrl+C in terminal.
 */
process.on('SIGINT', () => {
    logger.info('\n\nStopping monitor...');

    // Clean up all monitoring resources
    monitor.stopWatcher();

    // Display final statistics BEFORE closing database
    try {
        const stats = database.getStatistics();
        logger.info('\n📊 Session Statistics:');
        logger.info(`   World Sessions: ${stats.totalWorldSessions}`);
        logger.info(`   Player Encounters: ${stats.totalPlayerEncounters}`);
        logger.info(`   Unique Players: ${stats.uniquePlayersEncountered}`);
    } catch (error) {
        // Ignore stats errors during shutdown
    }

    // Stop web server
    webServer.stop();

    // Close database connection last
    database.close();

    logger.info('\n✅ Monitor stopped gracefully.');
    process.exit(0);
});
