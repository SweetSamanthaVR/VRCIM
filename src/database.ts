/**
 * Database Module for VRChat Instance Monitor
 * 
 * Manages SQLite database for tracking:
 * - World sessions (join/leave events with session UUIDs)
 * - Player activity (player join/leave events linked to world sessions)
 * 
 * Schema Design:
 * - world_activity: Tracks when user joins/leaves worlds
 * - player_activity: Tracks when other players join/leave during a session
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
    WorldActivity,
    PlayerActivity,
    PlayerHistory,
    DatabaseStatistics,
    AuthSession,
    CachedUser,
    VRChatUser,
    UserEncounter,
    CachedUserData,
    getErrorMessage
} from './types';
import { logger } from './logger';

/**
 * Database manager for VRChat monitoring data
 */
export class VRChatDatabase {
    private db: Database.Database;

    /**
     * Initialize the database connection and create tables if they don't exist
     * @param dbPath - Path to the SQLite database file
     */
    constructor(dbPath: string) {
        this.db = new Database(dbPath);

        // Enable WAL mode for better concurrent access and performance
        this.db.pragma('journal_mode = WAL');

        this.initializeTables();

        logger.info(`💾 Database initialized: ${path.basename(dbPath)}`);
    }

    /**
     * Create database tables with proper schema
     * Tables are created only if they don't already exist
     */
    private initializeTables(): void {
        // World Activity Table
        // Tracks user's world join/leave events with unique session UUIDs
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS world_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_uuid TEXT NOT NULL,
                event_type TEXT NOT NULL CHECK(event_type IN ('Joining World', 'Leaving World')),
                world_name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                world_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Player Activity Table
        // Tracks other players' join/leave events, linked to world sessions
        // Note: Foreign key constraint removed to allow more flexible data recording
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS player_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_uuid TEXT NOT NULL,
                event_type TEXT NOT NULL CHECK(event_type IN ('Player Joined', 'Player Left')),
                timestamp TEXT NOT NULL,
                player_name TEXT NOT NULL,
                player_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // VRChat Authentication Session Table
        // Stores the current authentication session for VRChat API
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS vrchat_auth_session (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                is_authenticated INTEGER NOT NULL DEFAULT 0,
                auth_cookie TEXT,
                two_factor_cookie TEXT,
                username TEXT,
                user_id TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_validated DATETIME,
                validation_failures INTEGER DEFAULT 0
            )
        `);

        // VRChat Users Cache Table
        // Stores minimal user profiles fetched from VRChat API
        // Only stores: username, displayName, tags, trustRank
        // Other details (bio, avatar, status, etc.) are fetched in real-time on demand
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS cached_users (
                id TEXT PRIMARY KEY,
                username TEXT,
                display_name TEXT,
                tags TEXT,
                trust_rank TEXT,
                first_seen TEXT NOT NULL,
                last_updated TEXT NOT NULL,
                times_encountered INTEGER DEFAULT 1
            )
        `);

        // User Encounters Table
        // Links each player encounter to the cached user profile
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_encounters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_uuid TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                world_name TEXT,
                event_type TEXT CHECK(event_type IN ('joined', 'left')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES cached_users(id)
            )
        `);

        // Run migrations BEFORE creating indexes (in case column names changed)
        this.runMigrations();

        // Create indexes for better query performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_world_session_uuid ON world_activity(session_uuid);
            CREATE INDEX IF NOT EXISTS idx_world_timestamp ON world_activity(timestamp);
            CREATE INDEX IF NOT EXISTS idx_player_session_uuid ON player_activity(session_uuid);
            CREATE INDEX IF NOT EXISTS idx_player_id ON player_activity(player_id);
            CREATE INDEX IF NOT EXISTS idx_player_timestamp ON player_activity(timestamp);
            CREATE INDEX IF NOT EXISTS idx_cached_users_username ON cached_users(username);
            CREATE INDEX IF NOT EXISTS idx_cached_users_display_name ON cached_users(display_name);
            CREATE INDEX IF NOT EXISTS idx_cached_users_trust_rank ON cached_users(trust_rank);
            CREATE INDEX IF NOT EXISTS idx_user_encounters_user_id ON user_encounters(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_encounters_session_uuid ON user_encounters(session_uuid);
            CREATE INDEX IF NOT EXISTS idx_user_encounters_timestamp ON user_encounters(timestamp);
        `);

        // Create composite indexes for optimized queries
        // These improve performance for common query patterns that filter and sort on multiple columns
        this.db.exec(`
            -- Composite index for encounter queries: filter by user_id + order by timestamp DESC
            -- Optimizes: SELECT * FROM user_encounters WHERE user_id = ? ORDER BY timestamp DESC
            CREATE INDEX IF NOT EXISTS idx_user_encounters_user_id_timestamp ON user_encounters(user_id, timestamp DESC);
            
            -- Composite index for session rebuild: filter by session_uuid + event_type
            -- Optimizes: SELECT * FROM player_activity WHERE session_uuid = ? AND event_type = ?
            CREATE INDEX IF NOT EXISTS idx_player_activity_session_event ON player_activity(session_uuid, event_type);
            
            -- Composite index for session timeline: filter by session_uuid + order by timestamp
            -- Optimizes: SELECT * FROM player_activity WHERE session_uuid = ? ORDER BY timestamp ASC
            CREATE INDEX IF NOT EXISTS idx_player_activity_session_timestamp ON player_activity(session_uuid, timestamp ASC);
            
            -- Composite index for world session queries: filter by session_uuid + order by timestamp
            -- Optimizes: SELECT * FROM world_activity WHERE session_uuid = ? ORDER BY timestamp
            CREATE INDEX IF NOT EXISTS idx_world_activity_session_timestamp ON world_activity(session_uuid, timestamp);
        `);
    }

    /**
     * Run database migrations to update schema for existing databases
     * Handles adding new columns and renaming columns to follow snake_case convention
     */
    private runMigrations(): void {
        // Migration 1: vrchat_auth_session table - Rename all camelCase columns to snake_case
        const authTableInfo = this.db.prepare("PRAGMA table_info(vrchat_auth_session)").all() as Array<{ name: string }>;
        const authColumnNames = authTableInfo.map(col => col.name);

        // Migrate is_authenticated
        if (authColumnNames.includes('isAuthenticated') && !authColumnNames.includes('is_authenticated')) {
            logger.info('🔄 Migrating database: Converting isAuthenticated to is_authenticated...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN isAuthenticated TO is_authenticated');
        }

        // Migrate auth_cookie
        if (authColumnNames.includes('authCookie') && !authColumnNames.includes('auth_cookie')) {
            logger.info('🔄 Migrating database: Converting authCookie to auth_cookie...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN authCookie TO auth_cookie');
        }

        // Migrate two_factor_cookie
        if (authColumnNames.includes('twoFactorCookie') && !authColumnNames.includes('two_factor_cookie')) {
            logger.info('🔄 Migrating database: Converting twoFactorCookie to two_factor_cookie...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN twoFactorCookie TO two_factor_cookie');
        }

        // Migrate user_id
        if (authColumnNames.includes('userId') && !authColumnNames.includes('user_id')) {
            logger.info('🔄 Migrating database: Converting userId to user_id...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN userId TO user_id');
        }

        // Migrate updated_at
        if (authColumnNames.includes('updatedAt') && !authColumnNames.includes('updated_at')) {
            logger.info('🔄 Migrating database: Converting updatedAt to updated_at...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN updatedAt TO updated_at');
        }

        // Migrate last_validated (add if missing)
        if (authColumnNames.includes('lastValidated') && !authColumnNames.includes('last_validated')) {
            logger.info('🔄 Migrating database: Converting lastValidated to last_validated...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN lastValidated TO last_validated');
        } else if (!authColumnNames.includes('last_validated') && !authColumnNames.includes('lastValidated')) {
            logger.info('🔄 Migrating database: Adding last_validated column to vrchat_auth_session...');
            this.db.exec('ALTER TABLE vrchat_auth_session ADD COLUMN last_validated DATETIME');
        }

        // Migrate validation_failures (add if missing)
        if (authColumnNames.includes('validationFailures') && !authColumnNames.includes('validation_failures')) {
            logger.info('🔄 Migrating database: Converting validationFailures to validation_failures...');
            this.db.exec('ALTER TABLE vrchat_auth_session RENAME COLUMN validationFailures TO validation_failures');
        } else if (!authColumnNames.includes('validation_failures') && !authColumnNames.includes('validationFailures')) {
            logger.info('🔄 Migrating database: Adding validation_failures column to vrchat_auth_session...');
            this.db.exec('ALTER TABLE vrchat_auth_session ADD COLUMN validation_failures INTEGER DEFAULT 0');
        }

        // Migration 2: cached_users table - Rename camelCase columns to snake_case
        const usersTableInfo = this.db.prepare("PRAGMA table_info(cached_users)").all() as Array<{ name: string }>;
        const usersColumnNames = usersTableInfo.map(col => col.name);

        if (usersColumnNames.includes('displayName') && !usersColumnNames.includes('display_name')) {
            logger.info('🔄 Migrating database: Converting displayName to display_name in cached_users...');
            this.db.exec('ALTER TABLE cached_users RENAME COLUMN displayName TO display_name');
        }

        if (usersColumnNames.includes('trustRank') && !usersColumnNames.includes('trust_rank')) {
            logger.info('🔄 Migrating database: Converting trustRank to trust_rank in cached_users...');
            this.db.exec('ALTER TABLE cached_users RENAME COLUMN trustRank TO trust_rank');
        }

        if (usersColumnNames.includes('firstSeen') && !usersColumnNames.includes('first_seen')) {
            logger.info('🔄 Migrating database: Converting firstSeen to first_seen in cached_users...');
            this.db.exec('ALTER TABLE cached_users RENAME COLUMN firstSeen TO first_seen');
        }

        if (usersColumnNames.includes('lastUpdated') && !usersColumnNames.includes('last_updated')) {
            logger.info('🔄 Migrating database: Converting lastUpdated to last_updated in cached_users...');
            this.db.exec('ALTER TABLE cached_users RENAME COLUMN lastUpdated TO last_updated');
        }

        if (usersColumnNames.includes('timesEncountered') && !usersColumnNames.includes('times_encountered')) {
            logger.info('🔄 Migrating database: Converting timesEncountered to times_encountered in cached_users...');
            this.db.exec('ALTER TABLE cached_users RENAME COLUMN timesEncountered TO times_encountered');
        }

        // Migration 3: user_encounters table - Rename camelCase columns to snake_case
        const encountersTableInfo = this.db.prepare("PRAGMA table_info(user_encounters)").all() as Array<{ name: string }>;
        const encountersColumnNames = encountersTableInfo.map(col => col.name);

        if (encountersColumnNames.includes('userId') && !encountersColumnNames.includes('user_id')) {
            logger.info('🔄 Migrating database: Converting userId to user_id in user_encounters...');
            this.db.exec('ALTER TABLE user_encounters RENAME COLUMN userId TO user_id');
        }

        if (encountersColumnNames.includes('sessionUuid') && !encountersColumnNames.includes('session_uuid')) {
            logger.info('🔄 Migrating database: Converting sessionUuid to session_uuid in user_encounters...');
            this.db.exec('ALTER TABLE user_encounters RENAME COLUMN sessionUuid TO session_uuid');
        }

        if (encountersColumnNames.includes('worldName') && !encountersColumnNames.includes('world_name')) {
            logger.info('🔄 Migrating database: Converting worldName to world_name in user_encounters...');
            this.db.exec('ALTER TABLE user_encounters RENAME COLUMN worldName TO world_name');
        }

        if (encountersColumnNames.includes('eventType') && !encountersColumnNames.includes('event_type')) {
            logger.info('🔄 Migrating database: Converting eventType to event_type in user_encounters...');
            this.db.exec('ALTER TABLE user_encounters RENAME COLUMN eventType TO event_type');
        }

        if (encountersColumnNames.includes('createdAt') && !encountersColumnNames.includes('created_at')) {
            logger.info('🔄 Migrating database: Converting createdAt to created_at in user_encounters...');
            this.db.exec('ALTER TABLE user_encounters RENAME COLUMN createdAt TO created_at');
        }
    }

    /**
     * Generate a new UUID for a world session
     * @returns A unique UUID string
     */
    generateSessionUUID(): string {
        return randomUUID();
    }

    /**
     * Record a world join or leave event
     * 
     * @param sessionUuid - Unique identifier for this world session
     * @param eventType - Either 'Joining World' or 'Leaving World'
     * @param worldName - Name of the VRChat world
     * @param timestamp - Timestamp from VRChat log (format: YYYY.MM.DD HH:MM:SS)
     * @param worldId - Full VRChat world ID with instance information
     */
    recordWorldActivity(
        sessionUuid: string,
        eventType: 'Joining World' | 'Leaving World',
        worldName: string,
        timestamp: string,
        worldId: string
    ): void {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO world_activity (session_uuid, event_type, world_name, timestamp, world_id)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(sessionUuid, eventType, worldName, timestamp, worldId);
        } catch (error) {
            logger.error(`❌ Failed to record world activity (${eventType}):`, error);
            throw error;
        }
    }

    /**
     * Record a player join or leave event
     * 
     * @param sessionUuid - UUID of the current world session (links to world_activity)
     * @param eventType - Either 'Player Joined' or 'Player Left'
     * @param timestamp - Timestamp from VRChat log (format: YYYY.MM.DD HH:MM:SS)
     * @param playerName - Display name of the player
     * @param playerId - VRChat user ID (usr_...)
     */
    recordPlayerActivity(
        sessionUuid: string,
        eventType: 'Player Joined' | 'Player Left',
        timestamp: string,
        playerName: string,
        playerId: string
    ): void {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO player_activity (session_uuid, event_type, timestamp, player_name, player_id)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(sessionUuid, eventType, timestamp, playerName, playerId);
        } catch (error) {
            logger.error(`❌ Failed to record player activity (${eventType} - ${playerName}):`, error);
            throw error;
        }
    }

    /**
     * Get all world sessions
     * Useful for reviewing historical world activity
     * 
     * @param limit - Maximum number of records to return (default: 100)
     * @returns Array of world activity records
     */
    getWorldActivity(limit: number = 100): WorldActivity[] {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM world_activity
                ORDER BY created_at DESC
                LIMIT ?
            `);

            return stmt.all(limit) as WorldActivity[];
        } catch (error) {
            logger.error(`❌ Failed to get world activity:`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Get all player activity for a specific session
     * 
     * @param sessionUuid - UUID of the world session
     * @returns Array of player activity records for that session
     */
    getPlayerActivityBySession(sessionUuid: string): PlayerActivity[] {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM player_activity
                WHERE session_uuid = ?
                ORDER BY timestamp ASC
            `);

            return stmt.all(sessionUuid) as PlayerActivity[];
        } catch (error) {
            logger.error(`❌ Failed to get player activity by session (${sessionUuid}):`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Get recent player activity across all sessions
     * 
     * @param limit - Maximum number of records to return (default: 100)
     * @returns Array of recent player activity records
     */
    getPlayerActivityRecent(limit: number = 100): PlayerActivity[] {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM player_activity
                ORDER BY created_at DESC
                LIMIT ?
            `);

            return stmt.all(limit) as PlayerActivity[];
        } catch (error) {
            logger.error(`❌ Failed to get recent player activity:`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Get all encounters with a specific player across all sessions
     * Useful for tracking when and where you've seen a particular player
     * 
     * @param playerId - VRChat user ID (usr_...)
     * @returns Array of all encounters with this player
     */
    getPlayerHistory(playerId: string): PlayerActivity[] {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    pa.*,
                    wa.world_name,
                    wa.world_id
                FROM player_activity pa
                JOIN world_activity wa ON pa.session_uuid = wa.session_uuid
                WHERE pa.player_id = ?
                ORDER BY pa.timestamp DESC
            `);

            return stmt.all(playerId) as PlayerActivity[];
        } catch (error) {
            logger.error(`❌ Failed to get player history (${playerId}):`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Get statistics about player encounters
     * 
     * @returns Object containing various statistics
     */
    getStatistics(): DatabaseStatistics {
        try {
            const worldSessions = this.db.prepare('SELECT COUNT(DISTINCT session_uuid) as count FROM world_activity').get() as { count: number };
            const playerEncounters = this.db.prepare('SELECT COUNT(*) as count FROM player_activity').get() as { count: number };
            const uniquePlayers = this.db.prepare('SELECT COUNT(DISTINCT player_id) as count FROM player_activity').get() as { count: number };
            const worldJoins = this.db.prepare("SELECT COUNT(*) as count FROM world_activity WHERE event_type = 'Joining World'").get() as { count: number };
            const worldLeaves = this.db.prepare("SELECT COUNT(*) as count FROM world_activity WHERE event_type = 'Leaving World'").get() as { count: number };
            const playerJoins = this.db.prepare("SELECT COUNT(*) as count FROM player_activity WHERE event_type = 'Player Joined'").get() as { count: number };
            const playerLeaves = this.db.prepare("SELECT COUNT(*) as count FROM player_activity WHERE event_type = 'Player Left'").get() as { count: number };

            return {
                totalWorldSessions: worldSessions.count,
                totalPlayerEncounters: playerEncounters.count,
                uniquePlayersEncountered: uniquePlayers.count,
                totalWorldJoins: worldJoins.count,
                totalWorldLeaves: worldLeaves.count,
                totalPlayerJoins: playerJoins.count,
                totalPlayerLeaves: playerLeaves.count
            };
        } catch (error) {
            logger.error(`❌ Failed to get statistics:`, getErrorMessage(error));
            return {
                totalWorldSessions: 0,
                totalPlayerEncounters: 0,
                uniquePlayersEncountered: 0,
                totalWorldJoins: 0,
                totalWorldLeaves: 0,
                totalPlayerJoins: 0,
                totalPlayerLeaves: 0
            };
        }
    }

    /**
     * Save VRChat authentication session to database
     * Only one session can exist at a time (id is always 1)
     * 
     * @param authData - Authentication data to store
     */
    saveAuthSession(authData: {
        isAuthenticated: boolean;
        authCookie: string | null;
        twoFactorCookie: string | null;
        username: string | null;
        userId: string | null;
        lastValidated?: string | null;
        validationFailures?: number;
    }): void {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO vrchat_auth_session 
                (id, is_authenticated, auth_cookie, two_factor_cookie, username, user_id, updated_at, last_validated, validation_failures)
                VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            `);

            stmt.run(
                authData.isAuthenticated ? 1 : 0,
                authData.authCookie,
                authData.twoFactorCookie,
                authData.username,
                authData.userId,
                authData.lastValidated || null,
                authData.validationFailures || 0
            );
        } catch (error) {
            logger.error(`❌ Failed to save auth session:`, error);
            throw error;
        }
    }

    /**
     * Get the current VRChat authentication session from database
     * 
     * @returns Authentication session data or null if not found
     */
    getAuthSession(): AuthSession | null {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    id,
                    is_authenticated,
                    auth_cookie,
                    two_factor_cookie,
                    username,
                    user_id,
                    updated_at,
                    last_validated,
                    validation_failures
                FROM vrchat_auth_session 
                WHERE id = 1
            `);

            const result = stmt.get();
            
            if (!result) {
                return null;
            }

            // Return result as AuthSession (database fields are already snake_case)
            return result as AuthSession;
        } catch (error) {
            logger.error(`❌ Failed to get auth session:`, getErrorMessage(error));
            return null;
        }
    }

    /**
     * Get the current active session UUID
     * Finds the most recent "Joining World" without a corresponding "Leaving World"
     * 
     * @returns Session UUID or null if no active session
     */
    getCurrentActiveSession(): string | null {
        try {
            const stmt = this.db.prepare(`
                SELECT session_uuid 
                FROM world_activity 
                WHERE event_type = 'Joining World'
                AND session_uuid NOT IN (
                    SELECT DISTINCT session_uuid 
                    FROM world_activity 
                    WHERE event_type = 'Leaving World'
                )
                ORDER BY timestamp DESC 
                LIMIT 1
            `);

            const result = stmt.get() as { session_uuid: string } | undefined;
            return result ? result.session_uuid : null;
        } catch (error) {
            logger.error(`❌ Failed to get current active session:`, error);
            return null;
        }
    }

    /**
     * Clear the VRChat authentication session from database
     */
    clearAuthSession(): void {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM vrchat_auth_session WHERE id = 1
            `);

            stmt.run();
        } catch (error) {
            logger.error(`❌ Failed to clear auth session:`, error);
            throw error;
        }
    }

    /**
     * Flush all activity records (world and player activity)
     * Keeps auth session and user profiles intact
     */
    flushActivityRecords(): void {
        try {
            this.db.exec(`
                DELETE FROM world_activity;
                DELETE FROM player_activity;
            `);
            logger.info('🗑️ Flushed all activity records');
        } catch (error) {
            logger.error(`❌ Failed to flush activity records:`, error);
            throw error;
        }
    }

    /**
     * Save or update a cached user profile
     * Only stores minimal data: username, displayName, tags, trustRank
     */
    saveUser(user: Partial<VRChatUser> & { id: string; trustRank?: string }): void {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO cached_users (
                    id, username, display_name, tags, trust_rank, first_seen, last_updated, times_encountered
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    username = excluded.username,
                    display_name = excluded.display_name,
                    tags = excluded.tags,
                    trust_rank = excluded.trust_rank,
                    last_updated = excluded.last_updated,
                    times_encountered = times_encountered + 1
            `);

            stmt.run(
                user.id,
                user.username || null,
                user.displayName || null,
                user.tags ? JSON.stringify(user.tags) : null,
                user.trustRank || 'unknown',
                new Date().toISOString(),
                new Date().toISOString(),
                1
            );
        } catch (error) {
            logger.error(`❌ Failed to save user (${user.id}):`, getErrorMessage(error));
            throw error;
        }
    }

    /**
     * Get a cached user by ID
     * Returns minimal cached data only
     */
    getUser(userId: string): CachedUserData | null {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    id,
                    username,
                    display_name as displayName,
                    tags,
                    trust_rank as trustRank,
                    first_seen as firstSeen,
                    last_updated as lastUpdated,
                    times_encountered as timesEncountered
                FROM cached_users 
                WHERE id = ?
            `);

            const user = stmt.get(userId);
            
            if (!user) return null;

            // Parse JSON fields and convert to proper type
            const dbUser = user as Record<string, unknown>;
            return {
                id: dbUser.id as string,
                username: dbUser.username as string,
                displayName: dbUser.displayName as string,
                bio: '',
                bioLinks: [],
                statusDescription: '',
                currentAvatarImageUrl: '',
                currentAvatarThumbnailImageUrl: '',
                state: '',
                status: '',
                tags: dbUser.tags ? JSON.parse(dbUser.tags as string) : [],
                last_login: '',
                last_platform: '',
                isFriend: false,
                trustRank: (dbUser.trustRank as string) || 'unknown',
                firstSeen: (dbUser.firstSeen as string) || new Date().toISOString(),
                lastUpdated: (dbUser.lastUpdated as string) || new Date().toISOString(),
                timesEncountered: (dbUser.timesEncountered as number) || 0
            };
        } catch (error) {
            logger.error(`❌ Failed to get user (${userId}):`, getErrorMessage(error));
            return null;
        }
    }

    /**
     * Get all cached users
     * Returns minimal cached data only
     */
    /**
     * Get all cached users with pagination support
     * @param limit Maximum number of users to return (default: 100, max: 1000)
     * @param offset Number of users to skip (default: 0)
     * @returns Array of user objects
     */
    getAllUsers(limit: number = 100, offset: number = 0): CachedUserData[] {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    id,
                    username,
                    display_name as displayName,
                    tags,
                    trust_rank as trustRank,
                    first_seen as firstSeen,
                    last_updated as lastUpdated,
                    times_encountered as timesEncountered
                FROM cached_users 
                ORDER BY last_updated DESC
                LIMIT ? OFFSET ?
            `);

            const users = stmt.all(limit, offset);
            
            return users.map((user) => {
                const dbUser = user as Record<string, unknown>;
                return {
                    id: dbUser.id as string,
                    username: dbUser.username as string,
                    displayName: dbUser.displayName as string,
                    bio: '',
                    bioLinks: [],
                    statusDescription: '',
                    currentAvatarImageUrl: '',
                    currentAvatarThumbnailImageUrl: '',
                    state: '',
                    status: '',
                    tags: dbUser.tags ? JSON.parse(dbUser.tags as string) : [],
                    last_login: '',
                    last_platform: '',
                    isFriend: false,
                    trustRank: (dbUser.trustRank as string) || 'unknown',
                    firstSeen: (dbUser.firstSeen as string) || new Date().toISOString(),
                    lastUpdated: (dbUser.lastUpdated as string) || new Date().toISOString(),
                    timesEncountered: (dbUser.timesEncountered as number) || 0
                };
            });
        } catch (error) {
            logger.error(`❌ Failed to get all users:`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Get total count of cached users
     * @returns Total number of users in database
     */
    getAllUsersCount(): number {
        try {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM cached_users
            `);

            const result = stmt.get() as { count: number };
            return result.count;
        } catch (error) {
            logger.error(`❌ Failed to get all users count:`, error);
            return 0;
        }
    }

    /**
     * Record a user encounter
     */
    recordUserEncounter(userId: string, sessionUuid: string, timestamp: string, worldName: string, eventType: 'joined' | 'left'): void {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_encounters (user_id, session_uuid, timestamp, world_name, event_type)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(userId, sessionUuid, timestamp, worldName, eventType);
        } catch (error) {
            logger.error(`❌ Failed to record user encounter (${userId}):`, error);
            throw error;
        }
    }

    /**
     * Get all encounters for a specific user
     */
    getUserEncounters(userId: string, limit: number = 100): UserEncounter[] {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    id,
                    user_id as userId,
                    session_uuid as sessionUuid,
                    timestamp,
                    world_name as worldName,
                    event_type as eventType
                FROM user_encounters
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `);

            return stmt.all(userId, limit) as UserEncounter[];
        } catch (error) {
            logger.error(`❌ Failed to get user encounters (${userId}):`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Get total count of encounters with a specific user
     */
    getUserEncountersCount(userId: string): number {
        try {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM user_encounters
                WHERE user_id = ?
            `);

            const result = stmt.get(userId) as { count: number };
            return result.count;
        } catch (error) {
            logger.error(`❌ Failed to get user encounters count (${userId}):`, error);
            return 0;
        }
    }

    /**
     * Record player join activity with transaction
     * Atomically executes: ensureUserExists + recordPlayerActivity + recordUserEncounter
     * 
     * @param userId - VRChat user ID
     * @param username - Player's username
     * @param sessionUuid - Current world session UUID
     * @param timestamp - Event timestamp
     * @param worldName - Current world name
     */
    recordPlayerJoinTransaction(
        userId: string,
        username: string,
        sessionUuid: string,
        timestamp: string,
        worldName: string
    ): void {
        try {
            const transaction = this.db.transaction(() => {
                // 1. Ensure user exists (create placeholder if needed)
                const cachedUser = this.getUser(userId);
                if (!cachedUser) {
                    const placeholderUser = {
                        id: userId,
                        username: username,
                        displayName: username,
                        firstSeen: timestamp,
                        trustRank: 'unknown'
                    };
                    this.saveUser(placeholderUser);
                }

                // 2. Record player activity
                this.recordPlayerActivity(
                    sessionUuid,
                    'Player Joined',
                    timestamp,
                    username,
                    userId
                );

                // 3. Record user encounter
                this.recordUserEncounter(
                    userId,
                    sessionUuid,
                    timestamp,
                    worldName,
                    'joined'
                );
            });

            transaction();
        } catch (error) {
            logger.error(`❌ Failed to record player join transaction (${username}):`, error);
            throw error;
        }
    }

    /**
     * Record player leave activity with transaction
     * Atomically executes: ensureUserExists + recordPlayerActivity + recordUserEncounter
     * 
     * @param userId - VRChat user ID
     * @param username - Player's username
     * @param sessionUuid - Current world session UUID
     * @param timestamp - Event timestamp
     * @param worldName - Current world name
     */
    recordPlayerLeaveTransaction(
        userId: string,
        username: string,
        sessionUuid: string,
        timestamp: string,
        worldName: string
    ): void {
        try {
            const transaction = this.db.transaction(() => {
                // 1. Ensure user exists (create placeholder if needed)
                const cachedUser = this.getUser(userId);
                if (!cachedUser) {
                    const placeholderUser = {
                        id: userId,
                        username: username,
                        displayName: username,
                        firstSeen: timestamp,
                        trustRank: 'unknown'
                    };
                    this.saveUser(placeholderUser);
                }

                // 2. Record player activity
                this.recordPlayerActivity(
                    sessionUuid,
                    'Player Left',
                    timestamp,
                    username,
                    userId
                );

                // 3. Record user encounter
                this.recordUserEncounter(
                    userId,
                    sessionUuid,
                    timestamp,
                    worldName,
                    'left'
                );
            });

            transaction();
        } catch (error) {
            logger.error(`❌ Failed to record player leave transaction (${username}):`, error);
            throw error;
        }
    }

    /**
     * Close the database connection gracefully
     * Should be called before application exit
     */
    close(): void {
        this.db.close();
        logger.info('💾 Database connection closed.');
    }
}
