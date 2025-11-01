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
        // Use 'auto' to dynamically construct WebSocket URL from window.location
        config = {
            wsUrl: 'auto',
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
    
    // If wsUrl is 'auto', construct it from current window location
    // This ensures WebSocket connection works when accessing via IP address or any hostname
    if (cfg.wsUrl === 'auto') {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${window.location.host}`;
    }
    
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
