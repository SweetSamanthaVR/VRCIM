/**
 * VRChat API Client
 * Fetches user information from the VRChat API
 */

import axios, { AxiosInstance } from 'axios';
import { VRChatAuthService } from './auth';
import { WebServer } from './webserver';
import { VRChatUser, EnrichedUser, getErrorMessage } from './types';
import { logger } from './logger';

export class VRChatAPIClient {
    private axiosInstance: AxiosInstance;
    private authService: VRChatAuthService;
    private webServer: WebServer | null = null;
    private requestQueue: Array<() => Promise<any>> = [];
    private processing = false;
    private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests (60/minute, matches VRCX)

    constructor(authService: VRChatAuthService, webServer?: WebServer) {
        this.authService = authService;
        this.webServer = webServer || null;
        this.axiosInstance = axios.create({
            baseURL: 'https://api.vrchat.cloud/api/1',
            headers: {
                'User-Agent': 'VRCIM/1.0',
            },
            withCredentials: true,
        });
    }

    /**
     * Get current queue size
     */
    getQueueSize(): number {
        return this.requestQueue.length;
    }

    /**
     * Broadcast queue status to connected clients
     */
    private broadcastQueueStatus(): void {
        if (this.webServer) {
            this.webServer.broadcastQueueStatus(this.requestQueue.length);
        }
    }

    /**
     * Process the request queue with rate limiting
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.requestQueue.length === 0) {
            return;
        }

        this.processing = true;
        this.broadcastQueueStatus(); // Show initial queue size

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            if (request) {
                try {
                    await request();
                } catch (error) {
                    logger.error('❌ Request failed:', error);
                }
                
                // Broadcast after request completes (not before)
                this.broadcastQueueStatus();
                
                // Wait before processing next request
                if (this.requestQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
                }
            }
        }

        this.processing = false;
        this.broadcastQueueStatus(); // Final update when queue is empty
    }

    /**
     * Add a request to the queue
     */
    private queueRequest<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.broadcastQueueStatus(); // Update when new request added
            this.processQueue();
        });
    }

    /**
     * Get authentication cookies from auth service
     * Automatically validates the token before returning
     */
    private async getAuthCookies(): Promise<string> {
        const authCookie = await this.authService.getValidatedAuthCookie();
        if (!authCookie) {
            throw new Error('No active VRChat session or authentication token expired');
        }
        return authCookie;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.authService.isAuthenticated();
    }

    /**
     * Fetch user information by user ID
     */
    async getUserInfo(userId: string): Promise<VRChatUser | null> {
        return this.queueRequest(async () => {
            try {
                const cookies = await this.getAuthCookies();
                
                const response = await this.axiosInstance.get(`/users/${userId}`, {
                    headers: {
                        Cookie: cookies,
                    },
                });

                const user = response.data;
                
                return {
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    bio: user.bio,
                    bioLinks: user.bioLinks || [],
                    statusDescription: user.statusDescription,
                    currentAvatarImageUrl: user.currentAvatarImageUrl,
                    currentAvatarThumbnailImageUrl: user.currentAvatarThumbnailImageUrl,
                    state: user.state,
                    status: user.status,
                    tags: user.tags || [],
                    last_login: user.last_login,
                    last_platform: user.last_platform,
                    isFriend: user.isFriend || false,
                };
            } catch (error) {
                if ((error as any).response?.status === 404) {
                    logger.warn(`⚠️ User not found: ${userId}`);
                    return null;
                }
                logger.error(`❌ Failed to fetch user ${userId}:`, getErrorMessage(error));
                throw error;
            }
        });
    }

    /**
     * Search for a user by username
     */
    async searchUser(username: string): Promise<VRChatUser | null> {
        return this.queueRequest(async () => {
            try {
                const cookies = await this.getAuthCookies();
                
                const response = await this.axiosInstance.get('/users', {
                    params: {
                        search: username,
                        n: 1,
                    },
                    headers: {
                        Cookie: cookies,
                    },
                });

                const users = response.data;
                if (users && users.length > 0) {
                    const user = users[0];
                    return {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        bio: user.bio,
                        bioLinks: user.bioLinks || [],
                        statusDescription: user.statusDescription,
                        currentAvatarImageUrl: user.currentAvatarImageUrl,
                        currentAvatarThumbnailImageUrl: user.currentAvatarThumbnailImageUrl,
                        state: user.state,
                        status: user.status,
                        tags: user.tags || [],
                        last_login: user.last_login,
                        last_platform: user.last_platform,
                        isFriend: user.isFriend || false,
                    };
                }

                return null;
            } catch (error) {
                logger.error(`❌ Failed to search user ${username}:`, getErrorMessage(error));
                throw error;
            }
        });
    }

    /**
     * Get user trust rank from tags
     */
    getUserTrustRank(tags: string[]): string {
        if (tags.includes('system_trust_legend') || tags.includes('system_trust_veteran')) {
            return 'Trusted User';
        }
        if (tags.includes('system_trust_trusted')) {
            return 'Known User';
        }
        if (tags.includes('system_trust_known')) {
            return 'User';
        }
        if (tags.includes('system_trust_basic')) {
            return 'New User';
        }
        return 'Visitor';
    }

    /**
     * Enrich user data with calculated trust rank
     */
    enrichUserData(user: VRChatUser): EnrichedUser {
        return {
            ...user,
            trustRank: this.getUserTrustRank(user.tags),
        };
    }
}
