/**
 * Common JavaScript - Shared utilities across all pages
 * Contains: Auth checking, utility functions, common UI interactions
 */

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

/**
 * Display an error message to the user
 */
function displayErrorMessage(message, details = null) {
    // Create error container if it doesn't exist
    let errorContainer = document.getElementById('global-error-container');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'global-error-container';
        errorContainer.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            max-width: 400px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(errorContainer);
    }
    
    // Create error message element
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.style.cssText = `
        background: var(--color-accent-error, #e74c3c);
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        animation: slideIn 0.3s ease;
        cursor: pointer;
        transition: opacity 0.2s;
    `;
    
    const messageText = document.createElement('div');
    messageText.style.cssText = `
        font-weight: 600;
        margin-bottom: 5px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    messageText.innerHTML = `<span style="font-size: 18px;">⚠️</span> ${escapeHtml(message)}`;
    errorEl.appendChild(messageText);
    
    if (details) {
        const detailsText = document.createElement('div');
        detailsText.style.cssText = `
            font-size: 0.9em;
            opacity: 0.9;
            margin-top: 5px;
        `;
        detailsText.textContent = details;
        errorEl.appendChild(detailsText);
    }
    
    const dismissHint = document.createElement('div');
    dismissHint.style.cssText = `
        font-size: 0.8em;
        opacity: 0.8;
        margin-top: 8px;
        font-style: italic;
    `;
    dismissHint.textContent = 'Click to dismiss';
    errorEl.appendChild(dismissHint);
    
    // Click to dismiss
    errorEl.addEventListener('click', () => {
        errorEl.style.opacity = '0';
        setTimeout(() => errorEl.remove(), 300);
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (errorEl.parentNode) {
            errorEl.style.opacity = '0';
            setTimeout(() => errorEl.remove(), 300);
        }
    }, 10000);
    
    errorContainer.appendChild(errorEl);
}

/**
 * Global error handler for uncaught exceptions
 */
window.onerror = function(message, source, lineno, colno, error) {
    console.error('❌ Uncaught error:', {
        message,
        source,
        lineno,
        colno,
        error
    });
    
    // Display user-friendly error message
    const userMessage = 'An unexpected error occurred';
    const details = error ? error.message : message;
    displayErrorMessage(userMessage, details);
    
    // Return true to prevent default browser error handling
    return true;
};

/**
 * Global handler for unhandled promise rejections
 */
window.onunhandledrejection = function(event) {
    console.error('❌ Unhandled promise rejection:', event.reason);
    
    // Display user-friendly error message
    const userMessage = 'An operation failed';
    const details = event.reason ? (event.reason.message || event.reason.toString()) : 'Unknown error';
    displayErrorMessage(userMessage, details);
    
    // Prevent default handling
    event.preventDefault();
};

/**
 * Wrap async functions with error handling
 */
function withErrorHandling(fn, errorMessage = 'Operation failed') {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            console.error(`❌ ${errorMessage}:`, error);
            displayErrorMessage(errorMessage, error.message);
            throw error;
        }
    };
}

/**
 * Safe fetch wrapper with error handling
 */
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return response;
    } catch (error) {
        console.error(`❌ Fetch failed (${url}):`, error);
        
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            displayErrorMessage('Network Error', 'Unable to connect to server. Please check your connection.');
        } else {
            displayErrorMessage('Request Failed', error.message);
        }
        
        throw error;
    }
}

// ============================================
// COMMON UTILITIES
// ============================================

/**
 * Check authentication status and update UI
 */
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        // Header elements
        const loginLink = document.getElementById('login-link');
        const authStatus = document.getElementById('header-auth-status');
        const authText = document.getElementById('header-auth-text');
        const authIndicator = document.getElementById('header-auth-indicator');
        const logoutBtn = document.getElementById('header-logout-btn');
        
        if (data.isAuthenticated) {
            // User is logged in
            if (loginLink) loginLink.style.display = 'none';
            if (authStatus) authStatus.style.display = 'flex';
            if (authText) authText.textContent = `👤 ${data.username || 'User'}`;
            if (authIndicator) {
                authIndicator.style.background = 'var(--color-accent-success)';
            }
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
        } else {
            // User is not logged in
            if (loginLink) loginLink.style.display = 'inline';
            if (authStatus) authStatus.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
        
        return data;
    } catch (error) {
        console.error('Failed to check auth status:', error);
        return { isAuthenticated: false };
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            alert('Logged out successfully');
            await checkAuthStatus(); // Refresh auth UI
            
            // Optionally redirect to home page
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        } else {
            alert('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Network error during logout');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format timestamp from VRChat log format to readable format
 * Input: "2025.10.27 20:03:51"
 * Output: Locale formatted date/time
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    // Handle VRChat log format: "2025.10.27 20:03:51"
    // Convert to ISO format: "2025-10-27T20:03:51"
    const isoTimestamp = timestamp.replace(/\./g, '-').replace(' ', 'T');
    const date = new Date(isoTimestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return timestamp; // Return original if can't parse
    }
    
    return date.toLocaleString();
}

/**
 * Show a temporary toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? 'var(--color-accent-error)' : 'var(--color-accent-success)'};
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Initialize logout button if present on page
 */
function initializeLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Also handle header logout button
    const headerLogoutBtn = document.getElementById('header-logout-btn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * Debounce function for search inputs
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for scroll handlers
 */
function throttle(func, wait) {
    let waiting = false;
    return function executedFunction(...args) {
        if (!waiting) {
            func.apply(this, args);
            waiting = true;
            setTimeout(() => {
                waiting = false;
            }, wait);
        }
    };
}

/**
 * Get trust rank CSS class
 */
function getTrustRankClass(trustRank) {
    if (!trustRank) return 'visitor';
    const rank = trustRank.toLowerCase().replace(/\s+/g, '-');
    return rank;
}

/**
 * Initialize common functionality when DOM is ready
 */
function initCommon() {
    // Check auth status on page load
    checkAuthStatus();
    
    // Initialize logout button
    initializeLogoutButton();
    
    // Add CSS animations
    if (!document.getElementById('common-animations')) {
        const style = document.createElement('style');
        style.id = 'common-animations';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommon);
} else {
    initCommon();
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkAuthStatus,
        handleLogout,
        escapeHtml,
        formatTimestamp,
        showToast,
        debounce,
        getTrustRankClass,
        displayErrorMessage,
        withErrorHandling,
        safeFetch
    };
}
