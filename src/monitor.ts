/**
 * VRChat Process and Log File Monitor
 * 
 * Handles:
 * - VRChat process detection
 * - Log file watching and reading
 * - Delegating log parsing to LogParser
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import { VRChatDatabase } from './database';
import { WebServer } from './webserver';
import { VRChatLogParser, ParseContext } from './logParser';
import { VRChatAPIClient } from './vrchatApiClient';
import { logger } from './logger';

const execAsync = promisify(exec);

export class VRChatMonitor {
    private isRunning: boolean = false;
    private checkInterval: number = 2000;
    private processName: string = 'VRChat.exe';
    private logDirectory: string;
    private currentLogFile: string | null = null;
    private fileWatcher: fs.FSWatcher | null = null;
    private lastReadPosition: number = 0;
    private logReadInterval: NodeJS.Timeout | null = null;
    private isInitialLoad: boolean = true; // Track if we're loading historical data

    private database: VRChatDatabase;
    private webServer: WebServer;
    private logParser: VRChatLogParser;
    private apiClient: VRChatAPIClient | null = null;

    // Parse context state
    private context: ParseContext = {
        currentWorldName: null,
        currentWorldId: null,
        currentSessionUUID: null,
        currentPlayersInWorld: new Set()
    };

    constructor(database: VRChatDatabase, webServer: WebServer, apiClient?: VRChatAPIClient) {
        // Load log directory from configuration
        this.logDirectory = config.vrchatLogPath;

        this.database = database;
        this.webServer = webServer;
        this.apiClient = apiClient || null;
        this.logParser = new VRChatLogParser(database, webServer, apiClient);
    }

    /**
     * Check if VRChat process is running
     */
    async checkVRChatProcess(): Promise<boolean> {
        try {
            const { stdout } = await execAsync(
                `powershell -Command "Get-Process -Name 'VRChat' -ErrorAction SilentlyContinue | Select-Object -First 1"`
            );
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Start monitoring
     */
    async start(): Promise<void> {
        logger.info('VRChat Monitor started...');
        logger.info(`Log Directory: ${this.logDirectory}`);
        logger.info('Monitoring for VRChat process and log files...\n');

        if (!fs.existsSync(this.logDirectory)) {
            logger.info('⚠ VRChat log directory not found. Will monitor for creation.');
        }

        const initialState = await this.checkVRChatProcess();
        this.isRunning = initialState;

        if (this.isRunning) {
            logger.info('✓ VRChat is currently running.');
            await this.detectCurrentLogFile();
        } else {
            logger.info('✗ VRChat is currently not running.');
        }

        this.startFileWatcher();

        setInterval(async () => {
            await this.monitor();
        }, this.checkInterval);
    }

    /**
     * Monitor VRChat process state changes
     */
    private async monitor(): Promise<void> {
        const currentState = await this.checkVRChatProcess();

        if (currentState !== this.isRunning) {
            if (currentState) {
                logger.info('\n🚀 VRChat is starting up...');
                setTimeout(async () => {
                    await this.detectCurrentLogFile();
                }, 1000);
            } else {
                logger.info('\n🔴 VRChat is closing down...');

                if (this.currentLogFile) {
                    logger.info(`📝 Final log file: ${path.basename(this.currentLogFile)}`);
                    this.stopLogMonitoring();
                    this.currentLogFile = null;
                }

                // Clear state
                this.context.currentWorldName = null;
                this.context.currentWorldId = null;
                this.context.currentSessionUUID = null;
                this.context.currentPlayersInWorld.clear();

                this.webServer.broadcastVRChatClosed();
            }

            this.isRunning = currentState;
        }
    }

    /**
     * Detect the current active log file
     */
    private async detectCurrentLogFile(): Promise<void> {
        try {
            if (!fs.existsSync(this.logDirectory)) {
                return;
            }

            const files = fs.readdirSync(this.logDirectory);
            const logFiles = files.filter(f => f.startsWith('output_log_') && f.endsWith('.txt'));

            if (logFiles.length === 0) {
                logger.info('⚠ No log files found yet.');
                return;
            }

            let newestFile: string | null = null;
            let newestTime = 0;

            for (const file of logFiles) {
                const filePath = path.join(this.logDirectory, file);
                const stats = fs.statSync(filePath);

                if (stats.mtimeMs > newestTime) {
                    newestTime = stats.mtimeMs;
                    newestFile = filePath;
                }
            }

            if (newestFile && newestFile !== this.currentLogFile) {
                this.currentLogFile = newestFile;
                const fileName = path.basename(newestFile);
                const fileSize = fs.statSync(newestFile).size;

                logger.info(`📄 Active log file detected: ${fileName}`);
                logger.info(`   Size: ${(fileSize / 1024).toFixed(2)} KB`);

                this.lastReadPosition = 0;
                this.isInitialLoad = true; // Set flag for initial historical data
                
                // Read existing log content (historical data)
                await this.readLogFileFromPositionSync();
                
                // After reading historical data, mark initial load complete
                this.isInitialLoad = false;
                logger.info('✓ Initial log history processed (users not queued for API fetch)');
                
                // Now start monitoring for NEW events in real-time
                this.startLogMonitoring();
            }
        } catch (error) {
            logger.error('Error detecting log file:', error);
        }
    }

    /**
     * Core log file reading logic shared by sync and async methods
     * Uses chunked streaming with line buffering to handle large files efficiently
     * 
     * @param shouldFetchUsers - Whether to fetch user data from API (true for real-time, false for historical)
     * @param showProgress - Whether to show progress logging for large files
     * @returns Promise that resolves when reading is complete, or void for fire-and-forget
     */
    private readLogFileFromPositionCore(
        shouldFetchUsers: boolean,
        showProgress: boolean
    ): Promise<void> | void {
        if (!this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
            return showProgress ? Promise.resolve() : undefined;
        }

        const processStream = (resolve?: () => void, reject?: (error: any) => void) => {
            try {
                const stats = fs.statSync(this.currentLogFile!);
                const currentSize = stats.size;
                const bytesToRead = currentSize - this.lastReadPosition;

                if (currentSize < this.lastReadPosition) {
                    this.lastReadPosition = 0;
                }

                if (currentSize > this.lastReadPosition) {
                    // Log progress for large files
                    if (showProgress && bytesToRead > 10 * 1024 * 1024) { // >10MB
                        logger.info(`📊 Processing large log file: ${(bytesToRead / 1024 / 1024).toFixed(2)} MB...`);
                    }

                    const CHUNK_SIZE = 64 * 1024; // 64KB chunks to reduce memory usage
                    const stream = fs.createReadStream(this.currentLogFile!, {
                        start: this.lastReadPosition,
                        end: currentSize - 1,
                        encoding: 'utf8',
                        highWaterMark: CHUNK_SIZE // Set chunk size for streaming
                    });

                    let lineBuffer = ''; // Buffer for incomplete lines
                    let processedBytes = 0;

                    stream.on('data', (chunk: string | Buffer) => {
                        // Process chunk immediately to avoid memory buildup
                        const chunkStr = chunk.toString();
                        lineBuffer += chunkStr;
                        processedBytes += chunkStr.length;

                        // Process complete lines from buffer
                        const lines = lineBuffer.split('\n');
                        // Keep last incomplete line in buffer
                        lineBuffer = lines.pop() || '';

                        // Process complete lines immediately
                        if (lines.length > 0) {
                            const completeText = lines.join('\n') + '\n';
                            this.context = this.logParser.parseLogContent(completeText, this.context, shouldFetchUsers);
                        }

                        // Log progress for large files (every 10MB)
                        if (showProgress && bytesToRead > 10 * 1024 * 1024 && processedBytes % (10 * 1024 * 1024) < CHUNK_SIZE) {
                            const progress = ((processedBytes / bytesToRead) * 100).toFixed(1);
                            logger.info(`   Progress: ${progress}% (${(processedBytes / 1024 / 1024).toFixed(2)} MB)`);
                        }
                    });

                    stream.on('end', () => {
                        // Process any remaining incomplete line
                        if (lineBuffer.length > 0) {
                            this.context = this.logParser.parseLogContent(lineBuffer, this.context, shouldFetchUsers);
                        }

                        this.lastReadPosition = currentSize;

                        if (showProgress && bytesToRead > 10 * 1024 * 1024) {
                            logger.info(`✓ Completed processing ${(bytesToRead / 1024 / 1024).toFixed(2)} MB`);
                        }

                        if (resolve) resolve();
                    });

                    stream.on('error', (error) => {
                        logger.error('❌ Error reading log file:', error);
                        if (reject) reject(error);
                    });
                } else {
                    if (resolve) resolve();
                }
            } catch (error) {
                logger.error('❌ Error in readLogFileFromPositionCore:', error);
                if (reject) reject(error);
            }
        };

        // Return Promise for synchronous/blocking version, or execute immediately for async
        if (showProgress) {
            return new Promise<void>((resolve, reject) => {
                processStream(resolve, reject);
            });
        } else {
            processStream();
            return undefined;
        }
    }

    /**
     * Read log file incrementally from last position (synchronous/blocking version for initial load)
     * Uses chunked streaming with line buffering to handle large files efficiently
     */
    private async readLogFileFromPositionSync(): Promise<void> {
        return this.readLogFileFromPositionCore(false, true) as Promise<void>;
    }

    /**
     * Read log file incrementally from last position (for real-time monitoring)
     * Uses chunked streaming with line buffering to handle large files efficiently
     */
    private readLogFileFromPosition(): void {
        this.readLogFileFromPositionCore(true, false);
    }

    /**
     * Start continuous log monitoring
     */
    private startLogMonitoring(): void {
        if (this.logReadInterval) {
            clearInterval(this.logReadInterval);
        }

        this.logReadInterval = setInterval(() => {
            this.readLogFileFromPosition();
        }, 1000);
    }

    /**
     * Stop log monitoring
     */
    private stopLogMonitoring(): void {
        if (this.logReadInterval) {
            clearInterval(this.logReadInterval);
            this.logReadInterval = null;
        }
    }

    /**
     * Start file system watcher
     */
    private startFileWatcher(): void {
        if (!fs.existsSync(this.logDirectory)) {
            return;
        }

        try {
            this.fileWatcher = fs.watch(this.logDirectory, async (eventType, filename) => {
                if (filename && filename.startsWith('output_log_') && filename.endsWith('.txt')) {
                    if (this.isRunning) {
                        await this.detectCurrentLogFile();
                    }
                }
            });

            logger.info('👁 File watcher initialized for log directory.');
        } catch (error) {
            logger.error('Error starting file watcher:', error);
        }
    }

    /**
     * Stop file watcher
     */
    stopWatcher(): void {
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = null;
        }

        this.stopLogMonitoring();
    }

    /**
     * Get the VR notification service instance
     */
    getVRNotificationService() {
        return this.logParser.getVRNotificationService();
    }
}
