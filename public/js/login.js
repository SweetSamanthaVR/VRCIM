/**
 * Login Page JavaScript (login.ejs)
 * Handles VRChat authentication flow including 2FA
 * Dependencies: common.js (for shared utilities)
 */

// DOM elements
const loginForm = document.getElementById('loginForm');
const twoFactorForm = document.getElementById('twoFactorForm');
const loggedInState = document.getElementById('loggedInState');
const alertBox = document.getElementById('alertBox');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusDisplay = document.getElementById('statusDisplay');
const statusBadge = document.getElementById('statusBadge');
const userInfoDiv = document.getElementById('userInfo');

/**
 * Show alert message
 */
function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    setTimeout(() => {
        alertBox.className = 'alert';
    }, 5000);
}

/**
 * Show loading spinner
 */
function showLoading() {
    loadingSpinner.classList.add('active');
    document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
}

/**
 * Hide loading spinner
 */
function hideLoading() {
    loadingSpinner.classList.remove('active');
}

/**
 * Show specific form step
 */
function showStep(stepElement) {
    document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
    stepElement.classList.add('active');
}

/**
 * Check authentication status and update UI
 */
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        statusDisplay.style.display = 'block';

        if (data.isAuthenticated) {
            statusBadge.textContent = '✓ Authenticated';
            statusBadge.className = 'status-badge authenticated';

            if (data.username) {
                const displayNameSpan = document.getElementById('user-display-name');
                const userIdDisplay = document.getElementById('user-id-display');
                const userIdValue = document.getElementById('user-id-value');
                
                displayNameSpan.textContent = data.username;
                
                if (data.userId) {
                    userIdValue.textContent = data.userId;
                    userIdDisplay.style.display = 'block';
                } else {
                    userIdDisplay.style.display = 'none';
                }
                
                userInfoDiv.style.display = 'block';
            }

            showStep(loggedInState);
        } else {
            statusBadge.textContent = '✗ Not Authenticated';
            statusBadge.className = 'status-badge unauthenticated';
            userInfoDiv.style.display = 'none';
            showStep(loginForm);
        }
    } catch (error) {
        console.error('❌ Failed to check auth status:', error);
        showStep(loginForm);
        
        // Display global error message
        if (typeof displayErrorMessage === 'function') {
            displayErrorMessage('Auth Check Failed', 'Unable to verify authentication status');
        }
    }
}

/**
 * Handle login form submission
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showAlert('Please enter both username and password', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showAlert('Login successful!', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else if (data.requires2FA) {
            showAlert('Two-factor authentication required. Check your email.', 'info');
            showStep(twoFactorForm);
            document.getElementById('twoFactorCode').focus();
        } else {
            showAlert(data.error || 'Login failed', 'error');
            showStep(loginForm);
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Login error:', error);
        showAlert('Network error. Please try again.', 'error');
        showStep(loginForm);
        
        // Display global error message
        if (typeof displayErrorMessage === 'function') {
            displayErrorMessage('Login Failed', error.message || 'Network error occurred');
        }
    }
});

/**
 * Handle 2FA form submission
 */
twoFactorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const code = document.getElementById('twoFactorCode').value.trim();

    if (!code || code.length !== 6) {
        showAlert('Please enter a valid 6-digit code', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch('/api/auth/verify-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showAlert('Authentication successful!', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showAlert(data.error || 'Verification failed', 'error');
            showStep(twoFactorForm);
            document.getElementById('twoFactorCode').value = '';
            document.getElementById('twoFactorCode').focus();
        }
    } catch (error) {
        hideLoading();
        console.error('❌ 2FA verification error:', error);
        showAlert('Network error. Please try again.', 'error');
        showStep(twoFactorForm);
        
        // Display global error message
        if (typeof displayErrorMessage === 'function') {
            displayErrorMessage('2FA Verification Failed', error.message || 'Network error occurred');
        }
    }
});

/**
 * Handle cancel button (return to login form)
 */
document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('twoFactorCode').value = '';
    document.getElementById('password').value = '';
    showStep(loginForm);
});

/**
 * Handle logout button
 */
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout?')) return;

    showLoading();

    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();

        hideLoading();

        if (data.success) {
            showAlert('Logged out successfully', 'success');
            // Clear form fields
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            document.getElementById('twoFactorCode').value = '';
            setTimeout(() => {
                checkLoginStatus();
            }, 1000);
        } else {
            showAlert('Logout failed', 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Logout error:', error);
        showAlert('Logout failed', 'error');
        
        // Display global error message
        if (typeof displayErrorMessage === 'function') {
            displayErrorMessage('Logout Failed', error.message || 'Network error occurred');
        }
    }
});

// Auto-fill username field from URL parameter (if present)
const urlParams = new URLSearchParams(window.location.search);
const usernameParam = urlParams.get('username');
if (usernameParam) {
    document.getElementById('username').value = usernameParam;
}

// Check auth status on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkLoginStatus);
} else {
    checkLoginStatus();
}
