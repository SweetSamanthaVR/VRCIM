/**
 * Web Server for VRChat Instance Monitor
 * Provides HTTP server for frontend and WebSocket for real-time updates
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import * as path from 'path';
import config, { getWebSocketUrl } from './config';
import { VRChatDatabase } from './database';
import { VRChatAuthService } from './auth';
import { VRChatAPIClient } from './vrchatApiClient';
import { getErrorMessage, WorldActivity, PlayerActivity, EnrichedUser } from './types';
import {
    validateUserIdParam,
    validatePlayerIdParam,
    validateSessionUuidParam,
    validateLoginCredentials,
    validate2FACode,
    validateLimit,
    validatePaginationQuery
} from './validators';
import { logger } from './logger';

export class WebServer {
    private app: express.Application;
    private server: Server;
    private wss: WebSocketServer;
    private database: VRChatDatabase;
    private authService: VRChatAuthService | null = null;
    private apiClient: VRChatAPIClient | null = null;
    private monitor: any = null; // VRChatMonitor instance (typed as any to avoid circular dependency)
    private port: number;
    private host: string;
    private clients: Set<WebSocket> = new Set();
    private currentSessionUUID: string | null = null;
    private currentPlayerCount: number = 0;

    constructor(database: VRChatDatabase) {
        this.database = database;
        this.port = config.port;
        this.host = config.host;
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    /**
     * Set the authentication service for handling VRChat API auth
     */
    setAuthService(authService: VRChatAuthService): void {
        this.authService = authService;
    }

    setAPIClient(apiClient: VRChatAPIClient): void {
        this.apiClient = apiClient;
    }

    /**
     * Set the monitor instance for notification control
     */
    setMonitor(monitor: any): void {
        this.monitor = monitor;
    }

    /**
     * Setup Express middleware
     */
    private setupMiddleware(): void {
        // Configure EJS as template engine
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, '..', 'views'));

        // Security Headers - Content Security Policy (XSS Protection)
        this.app.use((req, res, next) => {
            // Content-Security-Policy prevents XSS attacks by controlling resource loading
            res.setHeader('Content-Security-Policy', [
                "default-src 'self'",                          // Default: only load from same origin
                "script-src 'self'",                           // Scripts: only from same origin (no inline scripts)
                "style-src 'self' 'unsafe-inline'",            // Styles: same origin + inline styles (for style= attributes)
                "img-src 'self' data: https:",                 // Images: same origin, data URIs, and HTTPS sources
                "font-src 'self'",                             // Fonts: only from same origin
                "connect-src 'self' ws://localhost:* wss://localhost:*",  // API/WebSocket: same origin + localhost WebSockets
                "frame-ancestors 'none'",                      // Prevent clickjacking (no embedding in iframes)
                "base-uri 'self'",                             // Restrict base tag URLs
                "form-action 'self'",                          // Forms can only submit to same origin
                "object-src 'none'",                           // Block Flash, Java, etc.
                "upgrade-insecure-requests"                    // Automatically upgrade HTTP to HTTPS in production
            ].join('; '));

            // Additional security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');           // Prevent MIME type sniffing
            res.setHeader('X-Frame-Options', 'DENY');                     // Prevent clickjacking
            res.setHeader('X-XSS-Protection', '1; mode=block');           // Enable browser XSS filter
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');  // Control referrer information
            
            next();
        });

        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, '..', 'public')));

        // Parse JSON bodies
        this.app.use(express.json());

        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    /**
     * Setup HTTP routes
     */
    private setupRoutes(): void {
        // Get all logs with pagination
        this.app.get('/api/logs', (req, res) => {
            try {
                // Validate and sanitize limit parameter
                const limit = validateLimit(req.query.limit, config.recentActivityLimit, 1000);

                // Get combined logs from both tables
                const worldLogs = this.database.getWorldActivity(limit);
                const playerLogs = this.database.getPlayerActivityRecent(limit);

                // Add table identifier and combine
                const allLogs = [
                    ...worldLogs.map(log => ({ ...log, table: 'world_activity' })),
                    ...playerLogs.map(log => ({ ...log, table: 'player_activity' }))
                ];

                // Sort by timestamp (newest first)
                allLogs.sort((a, b) => {
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });

                const stats = this.database.getStatistics();

                res.json({
                    logs: allLogs.slice(0, limit),
                    stats: {
                        totalSessions: stats.totalWorldSessions,
                        totalEncounters: stats.totalPlayerEncounters,
                        uniquePlayers: stats.uniquePlayersEncountered
                    }
                });
            } catch (error) {
                logger.error('Error fetching logs:', getErrorMessage(error));
                res.status(500).json({ error: 'Failed to fetch logs' });
            }
        });

        // Get player history
        this.app.get('/api/player/:playerId', validatePlayerIdParam, (req, res) => {
            try {
                const history = this.database.getPlayerHistory(req.params.playerId);
                res.json({ history });
            } catch (error) {
                logger.error('Error fetching player history:', error);
                res.status(500).json({ error: 'Failed to fetch player history' });
            }
        });

        // Get session details
        this.app.get('/api/session/:sessionUuid', validateSessionUuidParam, (req, res) => {
            try {
                const players = this.database.getPlayerActivityBySession(req.params.sessionUuid);
                res.json({ players });
            } catch (error) {
                logger.error('Error fetching session details:', error);
                res.status(500).json({ error: 'Failed to fetch session details' });
            }
        });

        // User Profile Routes
        this.app.get('/api/users/cached', validatePaginationQuery, (req, res) => {
            try {
                const limit = parseInt(req.query.limit as string);
                const offset = parseInt(req.query.offset as string);
                
                const users = this.database.getAllUsers(limit, offset);
                const totalUsers = this.database.getAllUsersCount();
                
                // Add actual encounter counts for each user
                const usersWithCounts = users.map(user => ({
                    ...user,
                    timesEncountered: this.database.getUserEncountersCount(user.id)
                }));
                
                res.json({ 
                    users: usersWithCounts,
                    pagination: {
                        limit,
                        offset,
                        total: totalUsers,
                        hasMore: offset + limit < totalUsers
                    }
                });
            } catch (error) {
                logger.error('Error fetching cached users:', error);
                res.status(500).json({ error: 'Failed to fetch cached users' });
            }
        });

        this.app.get('/api/users/:userId', validateUserIdParam, (req, res) => {
            try {
                const user = this.database.getUser(req.params.userId);
                if (!user) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }
                
                const encounters = this.database.getUserEncounters(req.params.userId, 50);
                
                // Get actual total count of encounters (not just the limited results)
                const totalEncounters = this.database.getUserEncountersCount(req.params.userId);
                
                // Create response with encounter count
                const userWithEncounters = {
                    ...user,
                    timesEncountered: totalEncounters
                };
                
                res.json({ user: userWithEncounters, encounters });
            } catch (error) {
                logger.error('Error fetching user details:', getErrorMessage(error));
                res.status(500).json({ error: 'Failed to fetch user details' });
            }
        });

        // Get live user data from VRChat API (not cached)
        this.app.get('/api/users/:userId/live', validateUserIdParam, async (req, res) => {
            try {
                const userId = req.params.userId;
                
                if (!this.apiClient) {
                    res.status(503).json({ error: 'API client not available. Please login first.' });
                    return;
                }

                // Fetch fresh data from VRChat API
                const liveUserInfo = await this.apiClient.getUserInfo(userId);
                
                if (!liveUserInfo) {
                    res.status(404).json({ error: 'User not found in VRChat API' });
                    return;
                }

                // Enrich with trust rank
                const enrichedUser = this.apiClient.enrichUserData(liveUserInfo);
                
                // Try to get cached user for metadata (firstSeen, timesEncountered)
                const cachedUser = this.database.getUser(userId);
                
                // Get encounters (if user is in database)
                const encounters = cachedUser ? this.database.getUserEncounters(userId, 50) : [];
                const totalEncounters = cachedUser ? this.database.getUserEncountersCount(userId) : 0;
                
                // Combine cached and live data
                const combinedUser = {
                    // From cache (if available)
                    id: userId,
                    firstSeen: cachedUser?.firstSeen || 'Never encountered',
                    lastUpdated: cachedUser?.lastUpdated || new Date().toISOString(),
                    timesEncountered: totalEncounters,
                    // From live API
                    username: enrichedUser.username,
                    displayName: enrichedUser.displayName,
                    bio: enrichedUser.bio,
                    bioLinks: enrichedUser.bioLinks,
                    statusDescription: enrichedUser.statusDescription,
                    currentAvatarImageUrl: enrichedUser.currentAvatarImageUrl,
                    currentAvatarThumbnailImageUrl: enrichedUser.currentAvatarThumbnailImageUrl,
                    state: enrichedUser.state,
                    status: enrichedUser.status,
                    tags: enrichedUser.tags,
                    lastLogin: enrichedUser.last_login,
                    lastPlatform: enrichedUser.last_platform,
                    isFriend: enrichedUser.isFriend,
                    trustRank: enrichedUser.trustRank
                };
                
                res.json({ user: combinedUser, encounters });
            } catch (error) {
                logger.error('Error fetching live user data:', getErrorMessage(error));
                res.status(500).json({ error: getErrorMessage(error) || 'Failed to fetch live user data' });
            }
        });

        // Refresh user from VRChat API
        this.app.post('/api/users/:userId/refresh', validateUserIdParam, async (req, res) => {
            try {
                const userId = req.params.userId;
                const user = this.database.getUser(userId);
                
                if (!user) {
                    res.status(404).json({ success: false, error: 'User not found in database' });
                    return;
                }

                if (!this.apiClient) {
                    res.status(503).json({ success: false, error: 'API client not available' });
                    return;
                }

                logger.info(`🔄 Manual refresh requested for user: ${user.displayName || user.username} (${userId})`);
                
                // Fetch latest data from VRChat API
                const userInfo = await this.apiClient.getUserInfo(userId);
                
                if (!userInfo) {
                    res.status(404).json({ success: false, error: 'User not found in VRChat API' });
                    return;
                }

                // Enrich with trust rank
                const enrichedUser = this.apiClient.enrichUserData(userInfo);
                
                // Create user with metadata for database (preserving firstSeen)
                const userToSave = {
                    ...enrichedUser,
                    firstSeen: user.firstSeen
                };
                
                // Update database (only saves minimal fields now)
                this.database.saveUser(userToSave);
                
                logger.info(`✅ User refreshed: ${enrichedUser.displayName || enrichedUser.username} (${enrichedUser.trustRank})`);
                
                // Broadcast update to all connected clients
                this.broadcastUserCached(userId, enrichedUser);
                
                // Return minimal cached data
                const updatedUser = this.database.getUser(userId);
                res.json({ success: true, user: updatedUser });
            } catch (error) {
                logger.error('Error refreshing user:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) || 'Failed to refresh user' });
            }
        });

        // VRChat Authentication Routes
        this.app.post('/api/auth/login', validateLoginCredentials, async (req, res) => {
            try {
                if (!this.authService) {
                    res.status(500).json({ success: false, error: 'Auth service not initialized' });
                    return;
                }

                const { username, password } = req.body;
                const result = await this.authService.login({ username, password });
                res.json(result);
            } catch (error) {
                logger.error('✗ Login error:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) });
            }
        });

        this.app.post('/api/auth/verify-2fa', validate2FACode, async (req, res) => {
            try {
                if (!this.authService) {
                    res.status(500).json({ success: false, error: 'Auth service not initialized' });
                    return;
                }

                const { code } = req.body;
                const result = await this.authService.verify2FA(code);
                res.json(result);
            } catch (error) {
                logger.error('✗ 2FA verification error:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) });
            }
        });

        this.app.get('/api/auth/status', (req, res) => {
            if (!this.authService) {
                res.json({ isAuthenticated: false });
                return;
            }

            const authState = this.authService.getAuthState();
            res.json(authState);
        });

        this.app.post('/api/auth/logout', async (req, res) => {
            try {
                if (!this.authService) {
                    res.status(500).json({ success: false, error: 'Auth service not initialized' });
                    return;
                }

                await this.authService.clearAuth();
                res.json({ success: true });
            } catch (error) {
                logger.error('✗ Logout error:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) });
            }
        });

        // Configuration endpoint - provides frontend with runtime config
        this.app.get('/api/config', (req, res) => {
            res.json({
                wsUrl: getWebSocketUrl(),
                nodeEnv: config.nodeEnv,
                playersPerPage: config.playersPerPage,
                recentActivityLimit: config.recentActivityLimit,
                cachedUsersPerPage: config.cachedUsersPerPage
            });
        });

        // VR Notifications Control
        this.app.get('/api/notifications/status', (req, res) => {
            if (!this.monitor) {
                res.status(503).json({ success: false, error: 'Monitor not initialized' });
                return;
            }

            try {
                const vrService = this.monitor.getVRNotificationService();
                res.json({
                    success: true,
                    paused: vrService.isPaused()
                });
            } catch (error) {
                logger.error('Error getting notification status:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) });
            }
        });

        this.app.post('/api/notifications/pause', (req, res) => {
            if (!this.monitor) {
                res.status(503).json({ success: false, error: 'Monitor not initialized' });
                return;
            }

            try {
                const vrService = this.monitor.getVRNotificationService();
                vrService.pause();
                
                // Broadcast status change to all connected clients
                this.broadcastNotificationStatus(true);
                
                res.json({
                    success: true,
                    paused: true,
                    message: 'VR notifications paused'
                });
            } catch (error) {
                logger.error('Error pausing notifications:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) });
            }
        });

        this.app.post('/api/notifications/resume', (req, res) => {
            if (!this.monitor) {
                res.status(503).json({ success: false, error: 'Monitor not initialized' });
                return;
            }

            try {
                const vrService = this.monitor.getVRNotificationService();
                vrService.resume();
                
                // Broadcast status change to all connected clients
                this.broadcastNotificationStatus(false);
                
                res.json({
                    success: true,
                    paused: false,
                    message: 'VR notifications resumed'
                });
            } catch (error) {
                logger.error('Error resuming notifications:', getErrorMessage(error));
                res.status(500).json({ success: false, error: getErrorMessage(error) });
            }
        });

        // View routes - Render EJS templates
        this.app.get('/', (req, res) => {
            res.render('index', {
                title: 'VRChat Instance Monitor',
                pageCSS: 'monitor.css',
                pageJS: 'monitor.js'
            });
        });

        this.app.get('/login', (req, res) => {
            res.render('login', {
                title: 'Login',
                pageCSS: 'login.css',
                pageJS: 'login.js'
            });
        });

        this.app.get('/users', (req, res) => {
            res.render('users', {
                title: 'Cached Users',
                pageCSS: 'users.css',
                pageJS: 'users.js'
            });
        });

        this.app.get('/user-details', (req, res) => {
            res.render('user-details', {
                title: 'User Profile',
                pageCSS: 'user-details.css',
                pageJS: 'user-details.js'
            });
        });
    }

    /**
     * Setup WebSocket for real-time updates
     */
    private setupWebSocket(): void {
        this.wss.on('connection', (ws) => {
            // Silently add client (no console spam on every connection)
            this.clients.add(ws);

            // Send initial data
            try {
                // Only use currentSessionUUID from memory - if it's null, VRChat is not running
                // Do NOT fall back to database as that would show stale sessions
                const currentSession = this.currentSessionUUID;
                
                const worldLogs = this.database.getWorldActivity(config.recentActivityLimit);
                
                // Get ALL player activity for current session (not just last 50)
                // This ensures all player join/leave events are available for rebuilding the player list
                let playerLogs: any[];
                if (currentSession) {
                    playerLogs = this.database.getPlayerActivityBySession(currentSession);
                } else {
                    playerLogs = this.database.getPlayerActivityRecent(config.recentActivityLimit);
                }

                const allLogs = [
                    ...worldLogs.map(log => ({ ...log, table: 'world_activity' })),
                    ...playerLogs.map(log => ({ ...log, table: 'player_activity' }))
                ];

                allLogs.sort((a, b) => {
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });

                const stats = this.database.getStatistics();
                
                // Get current world info if there's an active session
                let currentWorldInfo: { world_name: string; world_id: string; timestamp: string } | null = null;
                if (currentSession) {
                    const worldStmt = this.database['db'].prepare(`
                        SELECT world_name, world_id, timestamp
                        FROM world_activity
                        WHERE session_uuid = ? AND event_type = 'Joining World'
                        ORDER BY timestamp DESC
                        LIMIT 1
                    `);
                    currentWorldInfo = worldStmt.get(currentSession) as { world_name: string; world_id: string; timestamp: string } | undefined || null;
                }

                ws.send(JSON.stringify({
                    type: 'initialData',
                    logs: allLogs,
                    stats: {
                        totalSessions: stats.totalWorldSessions,
                        totalEncounters: stats.totalPlayerEncounters,
                        uniquePlayers: stats.uniquePlayersEncountered
                    },
                    currentSession: currentSession,
                    currentWorld: currentWorldInfo?.world_name || null,
                    currentWorldTimestamp: currentWorldInfo?.timestamp || null,
                    playerCount: this.currentPlayerCount,
                    notificationsPaused: this.monitor ? this.monitor.getVRNotificationService().isPaused() : false
                }));
            } catch (error) {
                logger.error('Error sending initial data:', getErrorMessage(error));
            }

            ws.on('close', () => {
                // Silently remove client (no console spam)
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
    }

    /**
     * Broadcast a new log entry to all connected clients
     */
    broadcastLog(log: WorldActivity | PlayerActivity, table: 'world_activity' | 'player_activity'): void {
        const message = JSON.stringify({
            type: 'log',
            log: { ...log, table }
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }

    /**
     * Broadcast new session UUID
     */
    broadcastSession(sessionUUID: string): void {
        this.currentSessionUUID = sessionUUID;
        const message = JSON.stringify({
            type: 'session',
            sessionUUID
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Broadcast updated statistics
     */
    broadcastStats(): void {
        try {
            const stats = this.database.getStatistics();
            const message = JSON.stringify({
                type: 'stats',
                stats: {
                    totalSessions: stats.totalWorldSessions,
                    totalEncounters: stats.totalPlayerEncounters,
                    uniquePlayers: stats.uniquePlayersEncountered
                }
            });

            this.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(message);
                }
            });
        } catch (error) {
            logger.error('Error broadcasting stats:', getErrorMessage(error));
        }
    }

    /**
     * Broadcast current player count in world
     */
    broadcastPlayerCount(count: number): void {
        this.currentPlayerCount = count;
        const message = JSON.stringify({
            type: 'playerCount',
            count
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Broadcast API queue status
     */
    broadcastQueueStatus(queueSize: number): void {
        const message = JSON.stringify({
            type: 'apiQueue',
            size: queueSize
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Broadcast user cached event
     */
    broadcastUserCached(userId: string, user: EnrichedUser): void {
        const message = JSON.stringify({
            type: 'userCached',
            userId,
            user
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Broadcast that VRChat has closed
     */
    broadcastVRChatClosed(): void {
        this.currentSessionUUID = null;
        this.currentPlayerCount = 0;

        const message = JSON.stringify({
            type: 'vrchatClosed'
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Broadcast VR notification status change
     */
    broadcastNotificationStatus(paused: boolean): void {
        const message = JSON.stringify({
            type: 'notificationStatus',
            paused
        });

        this.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Start the web server
     */
    start(): void {
        this.server.listen(this.port, this.host, () => {
            const protocol = config.nodeEnv === 'production' ? 'https' : 'http';
            logger.info(`🌐 Web server running at ${protocol}://${this.host}:${this.port}`);
            logger.info(`🔌 WebSocket server ready for connections`);
        });
    }

    /**
     * Stop the web server
     */
    stop(): void {
        this.wss.close();
        this.server.close();
        logger.info('🌐 Web server stopped');
    }
}
