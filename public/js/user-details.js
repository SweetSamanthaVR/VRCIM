/**
 * User Details Page JavaScript (user-details.ejs)
 * Handles loading and displaying VRChat user profiles with live data
 * Dependencies: common.js (for shared utilities like escapeHtml, formatTimestamp, getTrustRankClass)
 * 
 * ⚠️ NOTE: This file contains HTML templates for dynamically creating the user profile display.
 * The HTML structure in displayUserInfo() function defines how the user profile looks.
 * If you need to modify the user profile layout, look for the displayUserInfo() function.
 * Static page structure is in views/user-details.ejs
 */

// Get user ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId');

// Virtual scrolling configuration for encounters
const ENCOUNTER_HEIGHT = 65; // Approximate height of each encounter item in pixels
const ENCOUNTER_BUFFER_SIZE = 10; // Number of items to render above/below viewport
let encounterScrollState = {
    scrollTop: 0,
    viewportHeight: 0,
    totalHeight: 0,
    startIndex: 0,
    endIndex: 0,
    isEnabled: false,
    encounters: []
};

/**
 * Initialize user details page
 */
function init() {
    if (!userId) {
        showError('No User ID Provided', 'Please provide a user ID in the URL parameters.');
        return;
    }

    setupRefreshButton();
    setupVirtualScrollingForEncounters();
    loadUserProfile(userId);
}

/**
 * Setup virtual scrolling for encounter history
 */
function setupVirtualScrollingForEncounters() {
    // Use throttled scroll handler for performance
    const handleScroll = throttle(() => {
        if (!encounterScrollState.isEnabled) return;
        
        updateEncounterVirtualScroll();
    }, 16); // ~60fps

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
}

/**
 * Calculate which encounter items should be visible in viewport
 */
function updateEncounterVirtualScroll() {
    if (!encounterScrollState.isEnabled || encounterScrollState.encounters.length === 0) return;

    const encounterList = document.getElementById('encounter-list');
    if (!encounterList) return;

    const listRect = encounterList.getBoundingClientRect();
    const listTop = listRect.top + window.pageYOffset;
    
    const scrollOffset = window.pageYOffset - listTop;
    const viewportHeight = window.innerHeight;
    
    // Calculate which items are in viewport
    const startIndex = Math.max(0, Math.floor(scrollOffset / ENCOUNTER_HEIGHT) - ENCOUNTER_BUFFER_SIZE);
    const endIndex = Math.min(
        encounterScrollState.encounters.length,
        Math.ceil((scrollOffset + viewportHeight) / ENCOUNTER_HEIGHT) + ENCOUNTER_BUFFER_SIZE
    );
    
    // Only update if indices changed significantly
    if (Math.abs(startIndex - encounterScrollState.startIndex) > ENCOUNTER_BUFFER_SIZE ||
        Math.abs(endIndex - encounterScrollState.endIndex) > ENCOUNTER_BUFFER_SIZE) {
        
        encounterScrollState.startIndex = startIndex;
        encounterScrollState.endIndex = endIndex;
        
        renderVirtualEncounters();
    }
}

/**
 * Render only visible encounter items for virtual scrolling
 */
function renderVirtualEncounters() {
    const encounterList = document.getElementById('encounter-list');
    if (!encounterList) return;

    const visibleEncounters = encounterScrollState.encounters.slice(
        encounterScrollState.startIndex,
        encounterScrollState.endIndex
    );

    // Calculate total height and offset
    const totalHeight = encounterScrollState.encounters.length * ENCOUNTER_HEIGHT;
    const offsetTop = encounterScrollState.startIndex * ENCOUNTER_HEIGHT;
    const offsetBottom = Math.max(0, totalHeight - offsetTop - (visibleEncounters.length * ENCOUNTER_HEIGHT));

    // Create HTML for visible items
    const encounterItems = visibleEncounters.map(encounter => `
        <div class="encounter-item">
            <div class="encounter-info">
                <div class="encounter-world">${escapeHtml(encounter.worldName)}</div>
                <div class="encounter-timestamp">${formatTimestamp(encounter.timestamp)}</div>
            </div>
            <div class="encounter-type ${escapeHtml(encounter.eventType)}">${escapeHtml(encounter.eventType)}</div>
        </div>
    `).join('');
    
    // Apply content with spacers to maintain scroll position
    encounterList.innerHTML = `
        <div class="virtual-spacer" style="height: ${offsetTop}px;"></div>
        ${encounterItems}
        <div class="virtual-spacer" style="height: ${offsetBottom}px;"></div>
    `;
}

/**
 * Setup refresh button event listener
 */
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (!refreshBtn) return;

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ Refreshing...';
        
        try {
            // Refresh the cache first
            const refreshResponse = await fetch(`/api/users/${userId}/refresh`, {
                method: 'POST'
            });
            
            if (!refreshResponse.ok) {
                throw new Error(`HTTP error! status: ${refreshResponse.status}`);
            }
            
            // Then reload with live data
            await loadUserProfile(userId);
            refreshBtn.textContent = '✅ Refreshed!';
            
            // Show success toast
            if (typeof showToast === 'function') {
                showToast('User data refreshed successfully!', 'success');
            }
            
            setTimeout(() => {
                refreshBtn.textContent = '🔄 Refresh from API';
                refreshBtn.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('❌ Error refreshing user:', error);
            
            if (typeof showToast === 'function') {
                showToast(`Failed to refresh user: ${error.message}`, 'error');
            } else {
                alert(`Failed to refresh user: ${error.message}`);
            }
            
            // Display global error message
            if (typeof displayErrorMessage === 'function') {
                displayErrorMessage('Refresh Failed', error.message);
            }
            
            refreshBtn.textContent = '🔄 Refresh from API';
            refreshBtn.disabled = false;
        }
    });
}

/**
 * Load user profile from API
 */
async function loadUserProfile(userId) {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const profileContent = document.getElementById('profile-content');
    
    // Show loading state
    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    profileContent.style.display = 'none';
    
    try {
        // Fetch live data from VRChat API (not cached)
        const response = await fetch(`/api/users/${userId}/live`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            } else if (response.status === 401) {
                throw new Error('Not authenticated. Please log in to VRChat.');
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const data = await response.json();
        displayUserProfile(data.user, data.encounters);
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        showError('Error Loading Profile', error.message, 'Make sure you\'re logged in to the VRChat API to view live user data.');
        
        // Display global error message
        if (typeof displayErrorMessage === 'function') {
            displayErrorMessage('Profile Load Failed', error.message);
        }
    }
}

/**
 * Display user profile data
 */
function displayUserProfile(user, encounters) {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const profileContent = document.getElementById('profile-content');
    const profileCard = document.getElementById('profile-card');
    const encountersSection = document.getElementById('encounters-section');
    const encounterList = document.getElementById('encounter-list');
    
    // Hide loading, show profile
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    profileContent.style.display = 'block';
    
    // Use placeholder avatar if none available
    const avatarUrl = user.currentAvatarThumbnailImageUrl || user.currentAvatarImageUrl || 'https://via.placeholder.com/150?text=No+Avatar';
    
    // Build bio links HTML
    let bioLinksHtml = '';
    if (user.bioLinks && user.bioLinks.length > 0) {
        const links = user.bioLinks.map(link => 
            `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="bio-link">${escapeHtml(link)}</a>`
        ).join('');
        bioLinksHtml = `<div class="bio-links">${links}</div>`;
    }

    // Build tags HTML
    let tagsHtml = '';
    if (user.tags && user.tags.length > 0) {
        const tags = user.tags.map(tag => 
            `<span class="tag">${escapeHtml(tag)}</span>`
        ).join('');
        tagsHtml = `
            <div style="margin-top: 20px;">
                <h2 style="font-size: 18px; margin-bottom: 10px;">Activity & Tags</h2>
                <div class="tags">${tags}</div>
            </div>
        `;
    }

    // Build encounters HTML
    let encountersHtml = '';
    if (encounters && encounters.length > 0) {
        const encounterItems = encounters.map(encounter => `
            <div class="encounter-item">
                <div class="encounter-info">
                    <div class="encounter-world">${escapeHtml(encounter.worldName)}</div>
                    <div class="encounter-timestamp">${formatTimestamp(encounter.timestamp)}</div>
                </div>
                <div class="encounter-type ${escapeHtml(encounter.eventType)}">${escapeHtml(encounter.eventType)}</div>
            </div>
        `).join('');
        
        encountersHtml = `
            <div class="encounters-section">
                <h2>Encounter History</h2>
                <div class="encounter-list">${encounterItems}</div>
            </div>
        `;
    }

    // Get status color
    const statusColor = getStatusColor(user.status);
    
    // Build profile HTML and populate the card
    profileCard.innerHTML = `
        <div class="profile-header">
            <img src="${escapeHtml(avatarUrl)}" 
                 alt="${escapeHtml(user.displayName || user.username)}" 
                 class="avatar" 
                 onerror="this.src='https://via.placeholder.com/150?text=No+Avatar'">
            <div class="user-info">
                <div class="display-name">${escapeHtml(user.displayName || user.username)}</div>
                <div class="username">@${escapeHtml(user.username || user.displayName || 'Unknown')}</div>
                <span class="trust-rank ${getTrustRankClass(user.trustRank)}">${escapeHtml(user.trustRank || 'Visitor')}</span>
                ${user.statusDescription ? `
                    <div class="status-description">${escapeHtml(user.statusDescription)}</div>
                ` : ''}
            </div>
        </div>

        ${user.bio ? `
            <div class="bio">
                <strong style="color: #00d9ff;">Bio:</strong><br>
                ${escapeHtml(user.bio)}
                ${bioLinksHtml}
            </div>
        ` : ''}

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">User ID</div>
                <div class="stat-value" style="font-size: 12px; word-break: break-all;">${escapeHtml(user.id)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Times Encountered</div>
                <div class="stat-value">${user.timesEncountered || 1}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">First Seen</div>
                <div class="stat-value" style="font-size: 14px;">${formatTimestamp(user.firstSeen)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last Updated</div>
                <div class="stat-value" style="font-size: 14px;">${formatTimestamp(user.lastUpdated)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Activity Status</div>
                <div class="stat-value" style="font-size: 16px; color: ${statusColor};">${escapeHtml(user.status || 'Unknown')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Visibility</div>
                <div class="stat-value" style="font-size: 14px;">${escapeHtml(user.state || 'Unknown')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last Login</div>
                <div class="stat-value" style="font-size: 14px;">${user.lastLogin ? formatTimestamp(user.lastLogin) : 'Hidden'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last Platform</div>
                <div class="stat-value" style="font-size: 14px;">${escapeHtml(user.lastPlatform || 'Unknown')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Friend Status</div>
                <div class="stat-value" style="font-size: 14px; color: ${user.isFriend ? '#00ff88' : '#aaa'};">${user.isFriend ? 'Friend' : 'Not Friend'}</div>
            </div>
        </div>

        ${tagsHtml}
        
        ${user.currentAvatarImageUrl ? `
            <div style="margin-top: 20px;">
                <h2 style="font-size: 18px; margin-bottom: 10px;">Avatar & Media</h2>
                <div style="background: #0f3460; padding: 15px; border-radius: 6px;">
                    <div style="margin-bottom: 10px;">
                        <strong style="color: #00d9ff;">Avatar Image:</strong><br>
                        <a href="${escapeHtml(user.currentAvatarImageUrl)}" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           style="color: #00d9ff; word-break: break-all; font-size: 12px;">${escapeHtml(user.currentAvatarImageUrl)}</a>
                    </div>
                    ${user.currentAvatarThumbnailImageUrl ? `
                        <div>
                            <strong style="color: #00d9ff;">Avatar Thumbnail:</strong><br>
                            <a href="${escapeHtml(user.currentAvatarThumbnailImageUrl)}" 
                               target="_blank" 
                               rel="noopener noreferrer"
                               style="color: #00d9ff; word-break: break-all; font-size: 12px;">${escapeHtml(user.currentAvatarThumbnailImageUrl)}</a>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
    `;

    // Build encounters HTML if available
    if (encounters && encounters.length > 0) {
        // Store encounters for virtual scrolling
        encounterScrollState.encounters = encounters;
        encounterScrollState.isEnabled = encounters.length > 100;
        
        if (encounterScrollState.isEnabled) {
            // Use virtual scrolling for large encounter lists
            encounterScrollState.scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            encounterScrollState.viewportHeight = window.innerHeight;
            encounterScrollState.startIndex = 0;
            encounterScrollState.endIndex = Math.min(50, encounters.length);
            
            renderVirtualEncounters();
        } else {
            // Normal rendering for small lists
            const encounterItems = encounters.map(encounter => `
                <div class="encounter-item">
                    <div class="encounter-info">
                        <div class="encounter-world">${escapeHtml(encounter.worldName)}</div>
                        <div class="encounter-timestamp">${formatTimestamp(encounter.timestamp)}</div>
                    </div>
                    <div class="encounter-type ${escapeHtml(encounter.eventType)}">${escapeHtml(encounter.eventType)}</div>
                </div>
            `).join('');
            
            encounterList.innerHTML = encounterItems;
        }
        
        encountersSection.style.display = 'block';
    } else {
        encountersSection.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError(title, message, additionalInfo = '') {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const profileContent = document.getElementById('profile-content');
    
    // Show error state
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    profileContent.style.display = 'none';
    
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    
    const additionalEl = document.getElementById('error-additional');
    if (additionalInfo) {
        additionalEl.textContent = additionalInfo;
        additionalEl.style.display = 'block';
    } else {
        additionalEl.style.display = 'none';
    }
}

/**
 * Get color for activity status
 */
function getStatusColor(status) {
    if (!status) return '#aaa';
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') return '#00ff88';
    if (statusLower === 'join me') return '#00d9ff';
    if (statusLower === 'busy') return '#ff9500';
    return '#aaa';
}

// Initialize page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
