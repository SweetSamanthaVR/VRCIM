/**
 * Type definitions for VRCIM
 * 
 * Centralized type definitions to replace 'any' types throughout the codebase
 * and provide better type safety and IDE support.
 */

// =============================================================================
// Database Types
// =============================================================================

/**
 * World activity record from the database
 */
export interface WorldActivity {
    id: number;
    session_uuid: string;
    event_type: 'Joining World' | 'Leaving World';
    world_name: string;
    timestamp: string;
    world_id: string;
    created_at: string;
}

/**
 * Player activity record from the database
 */
export interface PlayerActivity {
    id: number;
    session_uuid: string;
    event_type: 'Player Joined' | 'Player Left';
    player_name: string;
    player_id: string;
    timestamp: string;
    created_at: string;
}

/**
 * Player history record (aggregated data)
 */
export interface PlayerHistory {
    player_id: string;
    player_name: string;
    encounter_count: number;
    first_seen: string;
    last_seen: string;
}

/**
 * Database statistics
 */
export interface DatabaseStatistics {
    totalWorldSessions: number;
    totalPlayerEncounters: number;
    uniquePlayersEncountered: number;
    totalWorldJoins: number;
    totalWorldLeaves: number;
    totalPlayerJoins: number;
    totalPlayerLeaves: number;
}

/**
 * Authentication session stored in database (uses snake_case for database columns)
 */
export interface AuthSession {
    id: number;
    is_authenticated: number; // SQLite stores booleans as 0/1
    auth_cookie: string | null;
    two_factor_cookie: string | null;
    username: string | null;
    user_id: string | null;
    updated_at: string;
    last_validated: string | null;
    validation_failures: number;
}

/**
 * Helper to convert database auth session to application format
 */
export interface AppAuthSession {
    isAuthenticated: boolean;
    authCookie?: string;
    twoFactorCookie?: string;
    username?: string;
    userId?: string;
    lastValidated?: Date;
    validationFailures: number;
}

/**
 * VRChat user information stored in database
 */
export interface CachedUser {
    userId: string;
    username: string;
    displayName: string;
    bio: string;
    bioLinks: string;
    statusDescription: string;
    currentAvatarImageUrl: string;
    currentAvatarThumbnailImageUrl: string;
    state: string;
    status: string;
    tags: string;
    last_login: string;
    last_platform: string;
    isFriend: number; // SQLite stores booleans as 0/1
    cached_at: string;
}

/**
 * User encounter record from database
 */
export interface UserEncounter {
    id: number;
    userId: string;
    worldName: string;
    eventType: 'joined' | 'left';
    timestamp: string;
    sessionUuid: string;
}

// =============================================================================
// VRChat API Types
// =============================================================================

/**
 * VRChat user object from API
 */
export interface VRChatUser {
    id: string;
    username: string;
    displayName: string;
    bio: string;
    bioLinks: string[];
    statusDescription: string;
    currentAvatarImageUrl: string;
    currentAvatarThumbnailImageUrl: string;
    state: string;
    status: string;
    tags: string[];
    last_login: string;
    last_platform: string;
    isFriend: boolean;
}

/**
 * Enriched user data (includes trust rank and nuisance detection)
 */
export interface EnrichedUser extends VRChatUser {
    trustRank: string;
    isNuisance?: boolean;
    nuisanceType?: 'troll' | 'probable_troll' | null;
}

/**
 * Cached user data with database metadata
 */
export interface CachedUserData extends VRChatUser {
    trustRank: string;
    firstSeen: string;
    lastUpdated: string;
    timesEncountered: number;
}

/**
 * VRChat API login response
 */
export interface VRChatLoginResponse {
    requiresTwoFactorAuth?: string[];
    id?: string;
    username?: string;
    displayName?: string;
}

/**
 * VRChat API verify 2FA response
 */
export interface VRChatVerify2FAResponse {
    verified: boolean;
}

/**
 * VRChat API current user response
 */
export interface VRChatCurrentUserResponse {
    id: string;
    username: string;
    displayName: string;
}

// =============================================================================
// Application Types
// =============================================================================

/**
 * Authentication result
 */
export interface AuthResult {
    success: boolean;
    requires2FA?: boolean;
    error?: string;
}

/**
 * 2FA verification result
 */
export interface TwoFactorAuthResult {
    success: boolean;
    error?: string;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 'log' | 'user_cached' | 'connection_status' | 'queue_size';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
    type: WebSocketMessageType;
    data: any; // Intentionally any as data varies by message type
}

/**
 * Server HTTP response types
 */
export interface HTTPServer {
    listen(port: number, callback: () => void): void;
    close(callback?: (err?: Error) => void): void;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Pagination query parameters
 */
export interface PaginationQuery {
    limit?: string | number;
    offset?: string | number;
}

/**
 * Sanitized pagination parameters
 */
export interface SanitizedPagination {
    limit: number;
    offset: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error with message property (for catch blocks)
 */
export interface ErrorWithMessage {
    message: string;
    [key: string]: any;
}

/**
 * Type guard for error with message
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Convert unknown error to Error object
 */
export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (isErrorWithMessage(maybeError)) return maybeError;

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        // Fallback in case there's an error stringifying
        return new Error(String(maybeError));
    }
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
    return toErrorWithMessage(error).message;
}
