/**
 * Input validation utilities for API routes
 * Prevents SQL injection, XSS, and other malicious inputs
 */

import { Request, Response, NextFunction } from 'express';

/**
 * VRChat User ID format: usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * Where x is a hexadecimal character (0-9, a-f)
 */
const USER_ID_REGEX = /^usr_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/**
 * VRChat World ID format: wrld_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * Where x is a hexadecimal character (0-9, a-f)
 */
const WORLD_ID_REGEX = /^wrld_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/**
 * Session UUID format: standard UUID v4
 * xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const SESSION_UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/**
 * Validate VRChat User ID format
 */
export function validateUserId(userId: string): boolean {
    return USER_ID_REGEX.test(userId);
}

/**
 * Validate VRChat World ID format
 */
export function validateWorldId(worldId: string): boolean {
    return WORLD_ID_REGEX.test(worldId);
}

/**
 * Validate Session UUID format
 */
export function validateSessionUuid(sessionUuid: string): boolean {
    return SESSION_UUID_REGEX.test(sessionUuid);
}

/**
 * Validate positive integer (for pagination limits, etc.)
 */
export function validatePositiveInteger(value: unknown): boolean {
    const num = parseInt(String(value));
    return !isNaN(num) && num > 0 && num === parseFloat(String(value));
}

/**
 * Sanitize and validate limit parameter for queries
 * Ensures it's a positive integer within reasonable bounds
 */
export function validateLimit(limit: unknown, defaultValue: number = 100, maxValue: number = 1000): number {
    const parsed = parseInt(String(limit));
    if (isNaN(parsed) || parsed <= 0) {
        return defaultValue;
    }
    return Math.min(parsed, maxValue);
}

/**
 * Middleware: Validate User ID parameter
 */
export function validateUserIdParam(req: Request, res: Response, next: NextFunction): void {
    const userId = req.params.userId;
    
    if (!userId) {
        res.status(400).json({ 
            error: 'User ID is required',
            details: 'Missing userId parameter'
        });
        return;
    }
    
    if (!validateUserId(userId)) {
        res.status(400).json({ 
            error: 'Invalid User ID format',
            details: 'User ID must match format: usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        });
        return;
    }
    
    next();
}

/**
 * Middleware: Validate Player ID parameter (same as User ID)
 */
export function validatePlayerIdParam(req: Request, res: Response, next: NextFunction): void {
    const playerId = req.params.playerId;
    
    if (!playerId) {
        res.status(400).json({ 
            error: 'Player ID is required',
            details: 'Missing playerId parameter'
        });
        return;
    }
    
    if (!validateUserId(playerId)) {
        res.status(400).json({ 
            error: 'Invalid Player ID format',
            details: 'Player ID must match format: usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        });
        return;
    }
    
    next();
}

/**
 * Middleware: Validate Session UUID parameter
 */
export function validateSessionUuidParam(req: Request, res: Response, next: NextFunction): void {
    const sessionUuid = req.params.sessionUuid;
    
    if (!sessionUuid) {
        res.status(400).json({ 
            error: 'Session UUID is required',
            details: 'Missing sessionUuid parameter'
        });
        return;
    }
    
    if (!validateSessionUuid(sessionUuid)) {
        res.status(400).json({ 
            error: 'Invalid Session UUID format',
            details: 'Session UUID must be a valid UUID v4 format'
        });
        return;
    }
    
    next();
}

/**
 * Middleware: Validate login credentials
 */
export function validateLoginCredentials(req: Request, res: Response, next: NextFunction): void {
    const { username, password } = req.body;
    
    // Check if credentials exist
    if (!username || !password) {
        res.status(400).json({ 
            success: false,
            error: 'Missing credentials',
            details: 'Both username and password are required'
        });
        return;
    }
    
    // Validate username format (basic checks)
    if (typeof username !== 'string' || username.length < 1 || username.length > 100) {
        res.status(400).json({ 
            success: false,
            error: 'Invalid username',
            details: 'Username must be between 1 and 100 characters'
        });
        return;
    }
    
    // Validate password format (basic checks)
    if (typeof password !== 'string' || password.length < 1 || password.length > 200) {
        res.status(400).json({ 
            success: false,
            error: 'Invalid password',
            details: 'Password must be between 1 and 200 characters'
        });
        return;
    }
    
    // Check for obvious injection attempts
    const suspiciousPatterns = [
        /[<>]/,  // HTML tags
        /javascript:/i,  // JavaScript protocol
        /on\w+\s*=/i,  // Event handlers
        /\x00/,  // Null bytes
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(username) || pattern.test(password)) {
            res.status(400).json({ 
                success: false,
                error: 'Invalid characters in credentials',
                details: 'Credentials contain suspicious or disallowed characters'
            });
            return;
        }
    }
    
    next();
}

/**
 * Middleware: Validate 2FA code
 */
export function validate2FACode(req: Request, res: Response, next: NextFunction): void {
    const { code } = req.body;
    
    if (!code) {
        res.status(400).json({ 
            success: false,
            error: 'Missing 2FA code',
            details: '2FA code is required'
        });
        return;
    }
    
    if (typeof code !== 'string') {
        res.status(400).json({ 
            success: false,
            error: 'Invalid 2FA code format',
            details: '2FA code must be a string'
        });
        return;
    }
    
    // 2FA codes are typically 6-8 digits, or longer for backup codes
    if (code.length < 6 || code.length > 20) {
        res.status(400).json({ 
            success: false,
            error: 'Invalid 2FA code length',
            details: '2FA code must be between 6 and 20 characters'
        });
        return;
    }
    
    // Check for suspicious characters
    if (!/^[a-zA-Z0-9-]+$/.test(code)) {
        res.status(400).json({ 
            success: false,
            error: 'Invalid 2FA code format',
            details: '2FA code contains invalid characters'
        });
        return;
    }
    
    next();
}

/**
 * Middleware: Validate pagination query parameters (limit and offset)
 * Sanitizes and applies sensible defaults
 */
export function validatePaginationQuery(req: Request, res: Response, next: NextFunction): void {
    // Validate and sanitize limit parameter
    const limitParam = req.query.limit;
    if (limitParam !== undefined) {
        const limit = validateLimit(limitParam, 100, 1000);
        req.query.limit = limit.toString();
    } else {
        req.query.limit = '100'; // Default limit
    }
    
    // Validate and sanitize offset parameter
    const offsetParam = req.query.offset;
    if (offsetParam !== undefined) {
        const offset = parseInt(offsetParam as string);
        if (isNaN(offset) || offset < 0) {
            req.query.offset = '0'; // Default to 0 if invalid
        } else {
            req.query.offset = offset.toString();
        }
    } else {
        req.query.offset = '0'; // Default offset
    }
    
    next();
}
