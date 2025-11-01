/**
 * Frontend Configuration Module
 * Fetches runtime configuration from server
 */

let config = null;

/**
 * Fetch configuration from server
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfig() {
    if (config) {
        return config;
    }
    
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }
        config = await response.json();
        console.log('✓ Configuration loaded:', config);
        return config;
    } catch (error) {
        console.error('❌ Failed to load configuration:', error);
        // Fallback to defaults if config fetch fails
        config = {
            wsUrl: `ws://${window.location.hostname}:${window.location.port || 3000}`,
            nodeEnv: 'development'
        };
        console.warn('⚠ Using fallback configuration:', config);
        return config;
    }
}

/**
 * Get WebSocket URL from configuration
 * @returns {Promise<string>} WebSocket URL
 */
async function getWebSocketUrl() {
    const cfg = await loadConfig();
    return cfg.wsUrl;
}

/**
 * Get base API URL (uses current page URL)
 * @returns {string} Base API URL
 */
function getApiBaseUrl() {
    // API is on the same server as the page
    return window.location.origin;
}

/**
 * Check if running in production mode
 * @returns {Promise<boolean>}
 */
async function isProduction() {
    const cfg = await loadConfig();
    return cfg.nodeEnv === 'production';
}
