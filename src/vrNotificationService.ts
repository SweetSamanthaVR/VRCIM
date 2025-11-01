/**
 * VR Notification Service
 * Sends notifications to VR overlay applications (OVR Toolkit or XSOverlay)
 */

import * as dgram from 'dgram';
import WebSocket from 'ws';
import { logger } from './logger';

export class VRNotificationService {
    private ovrtWebSocket: WebSocket | null = null;
    private ovrtConnected: boolean = false;
    private xsoChecked: boolean = false;
    private readonly OVRT_WS_URL = 'ws://127.0.0.1:11450/api';
    private readonly XSO_UDP_PORT = 42069;
    private paused: boolean = false;

    constructor() {
        // Try to connect to OVR Toolkit on initialization
        this.initializeOVRToolkit();
    }

    /**
     * Pause VR notifications
     */
    pause(): void {
        this.paused = true;
        logger.info('🔇 VR notifications paused');
    }

    /**
     * Resume VR notifications
     */
    resume(): void {
        this.paused = false;
        logger.info('🔔 VR notifications resumed');
    }

    /**
     * Check if notifications are paused
     */
    isPaused(): boolean {
        return this.paused;
    }

    /**
     * Initialize WebSocket connection to OVR Toolkit
     */
    private initializeOVRToolkit(): void {
        try {
            this.ovrtWebSocket = new WebSocket(this.OVRT_WS_URL);

            this.ovrtWebSocket.on('open', () => {
                this.ovrtConnected = true;
                logger.info('✓ Connected to OVR Toolkit');
            });

            this.ovrtWebSocket.on('close', () => {
                this.ovrtConnected = false;
                // Silently disconnect - OVR Toolkit may not be running
                
                // Try to reconnect after 30 seconds
                setTimeout(() => this.initializeOVRToolkit(), 30000);
            });

            this.ovrtWebSocket.on('error', (error) => {
                this.ovrtConnected = false;
                // Silently fail if OVR Toolkit is not running
            });
        } catch (error) {
            // Silently fail if OVR Toolkit is not running
        }
    }

    /**
     * Send notification to OVR Toolkit (HUD notification)
     */
    private sendOVRToolkitNotification(title: string, body: string): boolean {
        if (!this.ovrtConnected || !this.ovrtWebSocket) {
            return false;
        }

        try {
            // HUD Notification (appears in lower view, disappears automatically)
            const hudMessage = {
                messageType: 'SendNotification',
                json: JSON.stringify({
                    title: title,
                    body: body
                })
            };

            this.ovrtWebSocket.send(JSON.stringify(hudMessage));
            logger.info(`📱 Sent OVR Toolkit notification: ${title}`);
            return true;
        } catch (error) {
            logger.error('Failed to send OVR Toolkit notification:', error);
            return false;
        }
    }

    /**
     * Send notification to XSOverlay (UDP)
     */
    private sendXSOverlayNotification(title: string, body: string): boolean {
        try {
            const client = dgram.createSocket('udp4');

            const message = {
                messageType: 1,
                title: title,
                content: body,
                height: 110,
                sourceApp: "VRCIM",
                timeout: 10.0, // 10 seconds
                audioPath: "",
                opacity: 1.0
            };

            const buffer = Buffer.from(JSON.stringify(message));
            
            client.send(buffer, this.XSO_UDP_PORT, '127.0.0.1', (error) => {
                if (error) {
                    logger.error('Failed to send XSOverlay notification:', error);
                } else {
                    logger.info(`📱 Sent XSOverlay notification: ${title}`);
                }
                client.close();
            });

            return true;
        } catch (error) {
            logger.error('Failed to send XSOverlay notification:', error);
            return false;
        }
    }

    /**
     * Send VR notification (tries OVR Toolkit first, falls back to XSOverlay)
     */
    sendVisitorNotification(visitorName: string): void {
        // Check if notifications are paused
        if (this.paused) {
            logger.debug(`🔇 Notification paused for visitor: ${visitorName}`);
            return;
        }

        const title = "⚠️ Visitor Detected";
        const body = `${visitorName} has joined the instance`;

        logger.info(`🚨 Visitor detected: ${visitorName}`);

        // Try OVR Toolkit first (if connected)
        if (this.ovrtConnected) {
            this.sendOVRToolkitNotification(title, body);
        } else {
            // Use XSOverlay if OVR Toolkit is not available
            if (!this.xsoChecked) {
                logger.info('ℹ XSOverlay notification sent (unable to verify connection status)');
                this.xsoChecked = true;
            }
            this.sendXSOverlayNotification(title, body);
        }
    }

    /**
     * Send VR notification for nuisance player
     */
    sendNuisanceNotification(playerName: string, nuisanceType: 'troll' | 'probable_troll'): void {
        // Check if notifications are paused
        if (this.paused) {
            logger.debug(`🔇 Notification paused for nuisance player: ${playerName}`);
            return;
        }

        const title = "🚨 Nuisance Player Alert";
        const typeText = nuisanceType === 'troll' ? 'nuisance tag' : 'probable nuisance tag';
        const body = `${playerName} has joined and has a ${typeText} applied by VRChat — be alert`;

        logger.warn(`🚨 Nuisance player detected: ${playerName} (${nuisanceType})`);

        // Try OVR Toolkit first (if connected)
        if (this.ovrtConnected) {
            this.sendOVRToolkitNotification(title, body);
        } else {
            // Use XSOverlay if OVR Toolkit is not available
            if (!this.xsoChecked) {
                logger.info('ℹ XSOverlay notification sent (unable to verify connection status)');
                this.xsoChecked = true;
            }
            this.sendXSOverlayNotification(title, body);
        }
    }

    /**
     * Close connections
     */
    close(): void {
        if (this.ovrtWebSocket) {
            this.ovrtWebSocket.close();
        }
    }
}
