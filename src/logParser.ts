/**
 * VRChat Log Parser Module
 * 
 * Handles parsing of VRChat log files to extract:
 * - World join/leave events
 * - Player join/leave events
 * - Timestamps and metadata
 */

import { VRChatDatabase } from './database';
import { WebServer } from './webserver';
import { VRChatAPIClient } from './vrchatApiClient';
import { VRNotificationService } from './vrNotificationService';
import { getErrorMessage } from './types';
import { logger } from './logger';

export interface ParseContext {
    currentWorldName: string | null;
    currentWorldId: string | null;
    currentSessionUUID: string | null;
    currentPlayersInWorld: Set<string>;
}

export class VRChatLogParser {
    private database: VRChatDatabase;
    private webServer: WebServer;
    private apiClient: VRChatAPIClient | null = null;
    private vrNotificationService: VRNotificationService;

    constructor(database: VRChatDatabase, webServer: WebServer, apiClient?: VRChatAPIClient) {
        this.database = database;
        this.webServer = webServer;
        this.apiClient = apiClient || null;
        this.vrNotificationService = new VRNotificationService();
    }

    /**
     * Get the VR notification service instance
     */
    getVRNotificationService(): VRNotificationService {
        return this.vrNotificationService;
    }

    /**
     * Parse VRChat log content and extract events
     * 
     * @param content - The log file content to parse
     * @param context - Current state context (world, session, players)
     * @param shouldFetchUsers - Whether to queue API requests for user caching (default: true)
     * @returns Updated context after parsing
     */
    parseLogContent(content: string, context: ParseContext, shouldFetchUsers: boolean = true): ParseContext {
        const lines = content.split('\n');

        // Temporary variables to accumulate world information as we parse
        let worldName: string | null = null;
        let worldId: string | null = null;
        let worldJoinTimestamp: string | null = null;

        // Process lines sequentially
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Parse world leave events
            context = this.parseWorldLeave(line, context);

            // Parse world join sequence
            const worldData = this.parseWorldJoinSequence(line, worldName, worldId, worldJoinTimestamp);
            worldName = worldData.worldName;
            worldId = worldData.worldId;
            worldJoinTimestamp = worldData.worldJoinTimestamp;

            // Check if we have complete world join info
            if (worldJoinTimestamp && worldName && worldId) {
                context = this.handleWorldJoin(worldName, worldId, worldJoinTimestamp, context);
                // Reset for next sequence
                worldName = null;
                worldId = null;
                worldJoinTimestamp = null;
            }

            // Parse player events (pass shouldFetchUsers flag)
            context = this.parsePlayerJoin(line, context, shouldFetchUsers);
            context = this.parsePlayerLeave(line, context);
        }

        return context;
    }

    /**
     * Parse world leave event
     */
    private parseWorldLeave(line: string, context: ParseContext): ParseContext {
        const onLeftRoomMatch = line.match(/^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}).*\[Behaviour\] OnLeftRoom/);

        if (onLeftRoomMatch && context.currentWorldName && context.currentWorldId) {
            const timestamp = onLeftRoomMatch[1];
            logger.info('\n🚪 Leaving World');
            logger.info(`   Time: ${timestamp}`);

            if (context.currentSessionUUID) {
                try {
                    this.database.recordWorldActivity(
                        context.currentSessionUUID,
                        'Leaving World',
                        context.currentWorldName,
                        timestamp,
                        context.currentWorldId
                    );

                    this.webServer.broadcastLog({
                        id: 0, // Temporary ID, will be assigned by database
                        session_uuid: context.currentSessionUUID,
                        event_type: 'Leaving World',
                        world_name: context.currentWorldName,
                        timestamp: timestamp,
                        world_id: context.currentWorldId,
                        created_at: new Date().toISOString()
                    }, 'world_activity');

                    this.webServer.broadcastStats();
                } catch (error) {
                    logger.error(`❌ Error in parseWorldLeave:`, error);
                    // Continue processing despite error
                }
            }

            // Clear world state
            context.currentWorldName = null;
            context.currentWorldId = null;
            context.currentSessionUUID = null;
            context.currentPlayersInWorld.clear();
            this.webServer.broadcastPlayerCount(0);
        }

        return context;
    }

    /**
     * Parse world join sequence patterns
     */
    private parseWorldJoinSequence(
        line: string,
        currentWorldName: string | null,
        currentWorldId: string | null,
        currentTimestamp: string | null
    ): { worldName: string | null; worldId: string | null; worldJoinTimestamp: string | null } {
        // Pattern 1: Extract world name
        const enteringRoomMatch = line.match(/\[Behaviour\] Entering Room: (.+)/);
        if (enteringRoomMatch) {
            currentWorldName = enteringRoomMatch[1].trim();
        }

        // Pattern 2: Extract world ID
        const joiningMatch = line.match(/\[Behaviour\] Joining (wrld_[^\s]+)/);
        if (joiningMatch) {
            currentWorldId = joiningMatch[1].trim();
        }

        // Pattern 3: Successfully joined confirmation
        const successfullyJoinedMatch = line.match(/^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}).*\[Behaviour\] Successfully joined room/);
        if (successfullyJoinedMatch) {
            currentTimestamp = successfullyJoinedMatch[1];
        }

        return {
            worldName: currentWorldName,
            worldId: currentWorldId,
            worldJoinTimestamp: currentTimestamp
        };
    }

    /**
     * Handle complete world join event
     */
    private handleWorldJoin(
        worldName: string,
        worldId: string,
        timestamp: string,
        context: ParseContext
    ): ParseContext {
        const isDifferentInstance = worldName !== context.currentWorldName || worldId !== context.currentWorldId;
        const wasNotInWorld = !context.currentWorldName;

        if (isDifferentInstance || wasNotInWorld) {
            // Generate new session UUID
            context.currentSessionUUID = this.database.generateSessionUUID();
            context.currentWorldName = worldName;
            context.currentWorldId = worldId;
            context.currentPlayersInWorld.clear();

            logger.info(`\n🌍 Joining World: ${worldName}`);
            logger.info(`   Time: ${timestamp}`);
            logger.info(`   Session: ${context.currentSessionUUID.substring(0, 8)}...`);
            logger.info(`🆔 World ID: ${worldId}`);

            try {
                // Record in database
                this.database.recordWorldActivity(
                    context.currentSessionUUID,
                    'Joining World',
                    worldName,
                    timestamp,
                    worldId
                );

                // Broadcast to web clients
                this.webServer.broadcastSession(context.currentSessionUUID);
                this.webServer.broadcastLog({
                    id: 0, // Temporary ID, will be assigned by database
                    session_uuid: context.currentSessionUUID,
                    event_type: 'Joining World',
                    world_name: worldName,
                    timestamp: timestamp,
                    world_id: worldId,
                    created_at: new Date().toISOString()
                }, 'world_activity');
                this.webServer.broadcastPlayerCount(0);
            } catch (error) {
                logger.error(`❌ Error in handleWorldJoin:`, error);
                // Continue processing despite error
            }
        }

        return context;
    }

    /**
     * Ensure user exists in database (create placeholder if needed)
     */
    private ensureUserExists(userId: string, username: string, timestamp: string): void {
        const cachedUser = this.database.getUser(userId);
        if (!cachedUser) {
            // Create placeholder user entry
            const placeholderUser = {
                id: userId,
                username: username,
                displayName: username,
                firstSeen: timestamp,
                trustRank: 'unknown'
            };
            this.database.saveUser(placeholderUser);
        }
    }

    /**
     * Fetch and cache user information from VRChat API
     * Only caches minimal fields: username, displayName, tags, trustRank
     * Other details are fetched on-demand when viewing user details
     */
    private async fetchAndCacheUser(userId: string, username: string, timestamp: string): Promise<void> {
        if (!this.apiClient) {
            return; // API client not available (e.g., not logged in)
        }

        // Check if authenticated before attempting to fetch
        if (!this.apiClient.isAuthenticated()) {
            logger.info(`   ⚠️  Not authenticated - skipping API fetch for: ${username}`);
            return;
        }

        try {
            // Check if user already has full profile data (not just placeholder)
            const cachedUser = this.database.getUser(userId);
            
            // Always refresh if user is a Visitor (they might rank up)
            const isVisitor = cachedUser && cachedUser.trustRank && cachedUser.trustRank.toLowerCase() === 'visitor';
            
            if (cachedUser && cachedUser.trustRank !== 'unknown' && !isVisitor) {
                logger.info(`   ℹ️  User already cached: ${username}`);
                return;
            }

            // Fetch from API (either new user, placeholder, or Visitor needing refresh)
            if (isVisitor) {
                logger.info(`   🔄 Refreshing Visitor user: ${username}...`);
            } else {
                logger.info(`   🔍 Queueing user info fetch for: ${username}...`);
            }
            
            const userInfo = await this.apiClient.getUserInfo(userId);

            if (userInfo) {
                // Enrich with trust rank
                const enrichedUser = this.apiClient.enrichUserData(userInfo);
                
                // Create user data with metadata for database
                const userToSave = {
                    ...enrichedUser,
                    firstSeen: cachedUser?.firstSeen || timestamp
                };

                // Update database with minimal profile (username, displayName, tags, trustRank only)
                this.database.saveUser(userToSave);
                
                if (isVisitor && enrichedUser.trustRank !== 'Visitor') {
                    logger.info(`   🎉 User ranked up: ${username} (Visitor → ${enrichedUser.trustRank})`);
                } else {
                    logger.info(`   ✅ Cached user: ${username} (${enrichedUser.trustRank})`);
                }
                
                // Send VR notification for nuisance players (takes priority over visitor notifications)
                if (enrichedUser.isNuisance && enrichedUser.nuisanceType) {
                    this.vrNotificationService.sendNuisanceNotification(
                        enrichedUser.displayName || username,
                        enrichedUser.nuisanceType
                    );
                }
                // Send VR notification if user is a Visitor (only if not a nuisance player)
                else if (enrichedUser.trustRank && enrichedUser.trustRank.toLowerCase() === 'visitor') {
                    this.vrNotificationService.sendVisitorNotification(enrichedUser.displayName || username);
                }
                
                // Broadcast that user is now cached/updated
                this.webServer.broadcastUserCached(userId, enrichedUser);
            }
        } catch (error) {
            logger.error(`   ❌ Failed to fetch user ${username}:`, getErrorMessage(error));
        }
    }

    /**
     * Parse player join event
     */
    private parsePlayerJoin(line: string, context: ParseContext, shouldFetchUsers: boolean = true): ParseContext {
        const playerJoinMatch = line.match(/^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}).*\[Behaviour\] OnPlayerJoined (.+?) \((usr_[a-f0-9\-]+)\)/);

        if (playerJoinMatch) {
            const timestamp = playerJoinMatch[1];
            const username = playerJoinMatch[2];
            const userId = playerJoinMatch[3];

            context.currentPlayersInWorld.add(userId);

            logger.info(`\n👤 Player Joined`);
            logger.info(`   Time: ${timestamp}`);
            logger.info(`   Name: ${username}`);
            logger.info(`   ID: ${userId}`);
            logger.info(`   Players in World: ${context.currentPlayersInWorld.size}`);

            if (context.currentSessionUUID) {
                try {
                    // Record player join with transaction (ensures atomicity of all 3 operations)
                    this.database.recordPlayerJoinTransaction(
                        userId,
                        username,
                        context.currentSessionUUID,
                        timestamp,
                        context.currentWorldName || 'Unknown'
                    );

                    // Fetch and cache full user info (only if shouldFetchUsers is true)
                    if (shouldFetchUsers) {
                        this.fetchAndCacheUser(userId, username, timestamp);
                    }

                    this.webServer.broadcastLog({
                        id: 0, // Temporary ID, will be assigned by database
                        session_uuid: context.currentSessionUUID,
                        event_type: 'Player Joined',
                        timestamp: timestamp,
                        player_name: username,
                        player_id: userId,
                        created_at: new Date().toISOString()
                    }, 'player_activity');

                    this.webServer.broadcastPlayerCount(context.currentPlayersInWorld.size);
                } catch (error) {
                    logger.error(`❌ Error in parsePlayerJoin:`, error);
                    // Continue processing despite error
                }
            }
        }

        return context;
    }

    /**
     * Parse player leave event
     */
    private parsePlayerLeave(line: string, context: ParseContext): ParseContext {
        const playerLeftMatch = line.match(/^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}).*\[Behaviour\] OnPlayerLeft (.+?) \((usr_[a-f0-9\-]+)\)/);

        if (playerLeftMatch) {
            const timestamp = playerLeftMatch[1];
            const username = playerLeftMatch[2];
            const userId = playerLeftMatch[3];

            context.currentPlayersInWorld.delete(userId);

            logger.info(`\n👋 Player Left`);
            logger.info(`   Time: ${timestamp}`);
            logger.info(`   Name: ${username}`);
            logger.info(`   ID: ${userId}`);
            logger.info(`   Players in World: ${context.currentPlayersInWorld.size}`);

            if (context.currentSessionUUID) {
                try {
                    // Record player leave with transaction (ensures atomicity of all 3 operations)
                    this.database.recordPlayerLeaveTransaction(
                        userId,
                        username,
                        context.currentSessionUUID,
                        timestamp,
                        context.currentWorldName || 'Unknown'
                    );

                    this.webServer.broadcastLog({
                        id: 0, // Temporary ID, will be assigned by database
                        session_uuid: context.currentSessionUUID,
                        event_type: 'Player Left',
                        timestamp: timestamp,
                        player_name: username,
                        player_id: userId,
                        created_at: new Date().toISOString()
                    }, 'player_activity');

                    this.webServer.broadcastPlayerCount(context.currentPlayersInWorld.size);
                } catch (error) {
                    logger.error(`❌ Error in parsePlayerLeave:`, error);
                    // Continue processing despite error
                }
            }
        }

        return context;
    }
}

