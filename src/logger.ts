/**
 * Logging Utility with Log Levels
 * 
 * Provides structured logging with different severity levels.
 * Log level can be controlled via LOG_LEVEL environment variable.
 * Console output can be disabled via ENABLE_CONSOLE_LOGS environment variable.
 * 
 * Log Levels (from lowest to highest priority):
 * - debug: Detailed information for diagnosing problems
 * - info: General informational messages
 * - warn: Warning messages for potentially harmful situations
 * - error: Error messages for serious problems
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

class Logger {
    private currentLevel: LogLevel;
    private consoleLogsEnabled: boolean;

    constructor() {
        // Parse log level from environment variable
        const envLevel = process.env.LOG_LEVEL?.toUpperCase();
        
        switch (envLevel) {
            case 'DEBUG':
                this.currentLevel = LogLevel.DEBUG;
                break;
            case 'INFO':
                this.currentLevel = LogLevel.INFO;
                break;
            case 'WARN':
                this.currentLevel = LogLevel.WARN;
                break;
            case 'ERROR':
                this.currentLevel = LogLevel.ERROR;
                break;
            case 'NONE':
                this.currentLevel = LogLevel.NONE;
                break;
            default:
                // Default to INFO in production, DEBUG in development
                this.currentLevel = process.env.NODE_ENV === 'production' 
                    ? LogLevel.INFO 
                    : LogLevel.DEBUG;
        }

        // Parse console logs enabled flag (default: true)
        const envConsoleLogsEnabled = process.env.ENABLE_CONSOLE_LOGS?.toLowerCase();
        this.consoleLogsEnabled = envConsoleLogsEnabled !== 'false';
    }

    /**
     * Check if a log level should be output
     */
    private shouldLog(level: LogLevel): boolean {
        return this.consoleLogsEnabled && level >= this.currentLevel;
    }

    /**
     * Format timestamp for logs
     */
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Log debug message (detailed diagnostic information)
     * Only shown when LOG_LEVEL=DEBUG
     */
    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(`[${this.getTimestamp()}] [DEBUG]`, message, ...args);
        }
    }

    /**
     * Log info message (general informational messages)
     * Default log level in production
     */
    info(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(`[${this.getTimestamp()}] [INFO]`, message, ...args);
        }
    }

    /**
     * Log warning message (potentially harmful situations)
     */
    warn(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(`[${this.getTimestamp()}] [WARN]`, message, ...args);
        }
    }

    /**
     * Log error message (serious problems)
     * Always shown unless LOG_LEVEL=NONE
     */
    error(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(`[${this.getTimestamp()}] [ERROR]`, message, ...args);
        }
    }

    /**
     * Set the current log level
     */
    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    /**
     * Get the current log level
     */
    getLevel(): LogLevel {
        return this.currentLevel;
    }

    /**
     * Get the current log level as a string
     */
    getLevelName(): string {
        switch (this.currentLevel) {
            case LogLevel.DEBUG: return 'DEBUG';
            case LogLevel.INFO: return 'INFO';
            case LogLevel.WARN: return 'WARN';
            case LogLevel.ERROR: return 'ERROR';
            case LogLevel.NONE: return 'NONE';
            default: return 'UNKNOWN';
        }
    }

    /**
     * Enable or disable console logging output
     */
    setConsoleLogsEnabled(enabled: boolean): void {
        this.consoleLogsEnabled = enabled;
    }

    /**
     * Check if console logging is enabled
     */
    isConsoleLogsEnabled(): boolean {
        return this.consoleLogsEnabled;
    }
}

// Export singleton instance
export const logger = new Logger();

// Export type for convenience
export type { Logger };
