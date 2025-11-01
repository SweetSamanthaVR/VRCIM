/**
 * Monitor Page JavaScript (index.ejs)
 * Handles real-time VRChat instance monitoring, WebSocket connection, and UI updates
 * Dependencies: common.js (for shared utilities)
 * 
 * ⚠️ NOTE: This file contains HTML templates for dynamically creating log entries and player cards.
 * The HTML structures in createLogHTML() and createPlayerCard() functions define how elements look.
 * If you need to modify layouts, look for these functions:
 * - createLogHTML() - Log entry cards
 * - createPlayerCard() - Player cards in instance
 * - showEmptyState() - Empty state message
 * - showVRChatNotRunning() - VRChat not running message
 * Static page structure is in views/index.ejs
 */

// State management
let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
const logsPerPage = 15;
let isConnected = false;
let currentSessionUUID = null;
let playersInWorld = 0;
let currentWorldName = null;
let sessionStartTime = null;
let playtimeInterval = null;
let vrchatRunning = false;

// Player cards state
let currentPlayers = new Map(); // Map of playerId -> { name, id, joinTime, cached, trustRank }
let playersCurrentPage = 1;
const playersPerPage = 20;

// WebSocket connection
let ws = null;

// Reconnection state
let reconnectAttempts = 0;
let reconnectTimeoutId = null;
let isManualDisconnect = false;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10; // After this, require manual retry

/**
 * Initialize the monitor application
 */
function init() {
    setupEventListeners();
    connectWebSocket();
    // Don't load initial data here - wait for WebSocket initialData message
    // Show "not running" state initially
    showVRChatNotRunning();
}

/**
 * Setup event listeners for UI controls
 */
function setupEventListeners() {
    // Log pagination
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderLogs();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderLogs();
        }
    });

    // Filters
    document.getElementById('filter-world').addEventListener('change', applyFilters);
    document.getElementById('filter-player').addEventListener('change', applyFilters);

    // Player pagination
    document.getElementById('players-prev-page').addEventListener('click', () => {
        if (playersCurrentPage > 1) {
            playersCurrentPage--;
            renderPlayerCards();
        }
    });

    document.getElementById('players-next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(currentPlayers.size / playersPerPage);
        if (playersCurrentPage < totalPages) {
            playersCurrentPage++;
            renderPlayerCards();
        }
    });

    // Manual reconnect button (will be added dynamically when needed)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'manual-reconnect-btn') {
            manualReconnect();
        }
    });
}

/**
 * Connect to WebSocket server for real-time updates
 * Uses exponential backoff reconnection strategy
 */
async function connectWebSocket() {
    try {
        // Clear any existing reconnect timeout
        if (reconnectTimeoutId) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
        }

        const wsUrl = await getWebSocketUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            isConnected = true;
            reconnectAttempts = 0; // Reset attempts on successful connection
            isManualDisconnect = false;
            updateConnectionStatus(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('❌ Failed to parse WebSocket message:', error);
                displayErrorMessage('Data Error', 'Received invalid data from server');
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            updateConnectionStatus(false);
            displayErrorMessage('Connection Error', 'WebSocket connection failed');
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            isConnected = false;
            updateConnectionStatus(false);
            
            // Don't attempt reconnect if manually disconnected
            if (isManualDisconnect) {
                return;
            }

            // Check if max attempts reached
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
                updateConnectionStatus(false, true); // true = show manual retry button
                return;
            }

            // Calculate exponential backoff delay with jitter
            const exponentialDelay = Math.min(
                BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
                MAX_RECONNECT_DELAY
            );
            // Add random jitter (0-1000ms) to prevent thundering herd
            const jitter = Math.random() * 1000;
            const delay = exponentialDelay + jitter;

            reconnectAttempts++;
            console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            updateConnectionStatus(false, false, reconnectAttempts); // Show reconnection attempt count
            
            // Schedule reconnection
            reconnectTimeoutId = setTimeout(connectWebSocket, delay);
        };
    } catch (error) {
        console.error('❌ Failed to connect to WebSocket:', error);
        updateConnectionStatus(false);
        displayErrorMessage('Connection Failed', 'Unable to establish WebSocket connection');
    }
}

/**
 * Manually trigger reconnection (used when max attempts reached)
 */
function manualReconnect() {
    console.log('🔄 Manual reconnection triggered');
    reconnectAttempts = 0; // Reset attempt counter
    connectWebSocket();
}

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(data) {
    try {
        if (data.type === 'apiQueue') {
            updateAPIQueue(data.size);
        } else if (data.type === 'userCached') {
            handleUserCached(data.userId, data.user);
        } else if (data.type === 'playerCount') {
            updatePlayerCount(data.count);
        } else if (data.type === 'log') {
            addNewLog(data.log);

            // Handle player join/leave
            if (data.log.event_type === 'Player Joined') {
                vrchatRunning = true;
                addPlayer(data.log.player_id, data.log.player_name);
            } else if (data.log.event_type === 'Player Left') {
                removePlayer(data.log.player_id);
            }
            // Start session timer when joining a world
            else if (data.log.event_type === 'Joining World') {
                vrchatRunning = true;
                updateCurrentWorld(data.log.world_name);
                startSessionTimer(data.log.timestamp);
                clearAllPlayers();
            }
            // Stop session timer when leaving a world
            else if (data.log.event_type === 'Leaving World') {
                updateCurrentWorld(null);
                stopSessionTimer();
                clearAllPlayers();
            }
        } else if (data.type === 'session') {
            currentSessionUUID = data.sessionUUID;
            updateCurrentSession(data.sessionUUID);
        } else if (data.type === 'vrchatClosed') {
            vrchatRunning = false;
            updateCurrentWorld(null);
            updatePlayerCount(0);
            updateCurrentSession(null);
            stopSessionTimer();
            clearAllPlayers();
            showVRChatNotRunning();
        } else if (data.type === 'initialData') {
            allLogs = data.logs || [];
            currentSessionUUID = data.currentSession || null;
            playersInWorld = data.playerCount || 0;
            updateCurrentSession(currentSessionUUID);
            updatePlayerCount(playersInWorld);

            // VRChat is only running if we have both a current session AND current world
            if (currentSessionUUID && data.currentWorld) {
                vrchatRunning = true;
                updateCurrentWorld(data.currentWorld);
                if (data.currentWorldTimestamp) {
                    startSessionTimer(data.currentWorldTimestamp);
                }
                await rebuildPlayerListFromLogs();
                applyFilters();
            } else {
                // VRChat is not currently running
                vrchatRunning = false;
                showVRChatNotRunning();
            }
        }
    } catch (error) {
        console.error('❌ Error handling WebSocket message:', error);
        // Don't display error message for every WebSocket message failure
        // as it would be too disruptive
    }
}

/**
 * Load initial data from server
 */
async function loadInitialData() {
    try {
        const response = await fetch('/api/logs');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        allLogs = data.logs || [];
        
        // Only show logs if VRChat is running
        if (vrchatRunning) {
            applyFilters();
        } else {
            showVRChatNotRunning();
        }
    } catch (error) {
        console.error('❌ Failed to load initial data:', error);
        displayErrorMessage('Failed to Load Data', 'Unable to load monitoring logs');
        showEmptyState();
    }
}

/**
 * Add a new log entry (real-time update)
 */
function addNewLog(log) {
    allLogs.unshift(log); // Add to beginning (newest first)
    applyFilters();
    currentPage = 1; // Reset to page 1 to show new entry
}

/**
 * Apply filters and refresh display
 */
function applyFilters() {
    // Don't show logs if VRChat is not running
    if (!vrchatRunning) {
        showVRChatNotRunning();
        return;
    }

    const showWorld = document.getElementById('filter-world').checked;
    const showPlayer = document.getElementById('filter-player').checked;

    filteredLogs = allLogs.filter(log => {
        if (log.table === 'world_activity' && showWorld) return true;
        if (log.table === 'player_activity' && showPlayer) return true;
        return false;
    });

    currentPage = 1;
    renderLogs();
}

/**
 * Render logs for current page
 */
function renderLogs() {
    const logsContainer = document.getElementById('logs-list');

    if (filteredLogs.length === 0) {
        showEmptyState();
        return;
    }

    const startIndex = (currentPage - 1) * logsPerPage;
    const endIndex = startIndex + logsPerPage;
    const pageData = filteredLogs.slice(startIndex, endIndex);

    logsContainer.innerHTML = pageData.map(log => createLogHTML(log)).join('');
    updatePaginationControls();
}

/**
 * Create HTML for a single log entry
 */
function createLogHTML(log) {
    const isWorld = log.table === 'world_activity';
    const eventClass = getEventClass(log.event_type);
    const icon = getEventIcon(log.event_type);

    if (isWorld) {
        return `
            <div class="log-entry ${eventClass}">
                <div class="log-header">
                    <div class="log-type">${icon} ${log.event_type}</div>
                    <div class="log-timestamp">${log.timestamp}</div>
                </div>
                <div class="log-details">
                    <div><strong>World:</strong> ${escapeHtml(log.world_name)}</div>
                    <div><strong>Session:</strong> <span class="session-id">${log.session_uuid.substring(0, 8)}...</span></div>
                    <div><strong>World ID:</strong> ${log.world_id}</div>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="log-entry ${eventClass}">
                <div class="log-header">
                    <div class="log-type">${icon} ${log.event_type}</div>
                    <div class="log-timestamp">${log.timestamp}</div>
                </div>
                <div class="log-details">
                    <div><strong>Player:</strong> ${escapeHtml(log.player_name)}</div>
                    <div><strong>Player ID:</strong> ${log.player_id}</div>
                    <div><strong>Session:</strong> <span class="session-id">${log.session_uuid.substring(0, 8)}...</span></div>
                </div>
            </div>
        `;
    }
}

/**
 * Get CSS class for event type
 */
function getEventClass(eventType) {
    const classMap = {
        'Joining World': 'world-join',
        'Leaving World': 'world-leave',
        'Player Joined': 'player-join',
        'Player Left': 'player-leave'
    };
    return classMap[eventType] || '';
}

/**
 * Get icon for event type
 */
function getEventIcon(eventType) {
    const iconMap = {
        'Joining World': '🌍',
        'Leaving World': '🚪',
        'Player Joined': '👤',
        'Player Left': '👋'
    };
    return iconMap[eventType] || '•';
}

/**
 * Update pagination controls
 */
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages || totalPages === 0;
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

/**
 * Show empty state when no logs available
 */
function showEmptyState() {
    const logsContainer = document.getElementById('logs-list');
    const emptyStateTemplate = document.getElementById('empty-state-template');
    
    if (emptyStateTemplate) {
        logsContainer.innerHTML = emptyStateTemplate.outerHTML.replace('style="display: none;"', '');
    } else {
        // Fallback if template doesn't exist
        logsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">No logs available</div>
            </div>
        `;
    }
    updatePaginationControls();
}

/**
 * Update connection status indicator
 * @param {boolean} connected - Connection status
 * @param {boolean} showManualRetry - Whether to show manual retry button
 * @param {number} attemptCount - Current reconnection attempt number
 */
function updateConnectionStatus(connected, showManualRetry = false, attemptCount = 0) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');

    if (connected) {
        indicator.classList.remove('offline');
        indicator.classList.add('online');
        text.innerHTML = 'Connected';
    } else {
        indicator.classList.remove('online');
        indicator.classList.add('offline');
        
        if (showManualRetry) {
            // Max attempts reached - show manual retry button
            text.innerHTML = `
                Disconnected 
                <button id="manual-reconnect-btn" class="retry-btn">Retry Now</button>
            `;
        } else if (attemptCount > 0) {
            // Reconnecting with attempt count
            text.innerHTML = `Reconnecting... (attempt ${attemptCount}/${MAX_RECONNECT_ATTEMPTS})`;
        } else {
            // Just disconnected
            text.textContent = 'Disconnected';
        }
    }
}

/**
 * Update statistics display
 */
function updatePlayerCount(count) {
    playersInWorld = count;
    document.getElementById('players-in-world').textContent = count;
}

/**
 * Update current session display
 */
function updateCurrentSession(sessionUUID) {
    const sessionEl = document.getElementById('current-session');
    if (sessionUUID) {
        sessionEl.textContent = sessionUUID.substring(0, 8) + '...';
    } else {
        sessionEl.textContent = '—';
    }
}

/**
 * Update current world display
 */
function updateCurrentWorld(worldName) {
    currentWorldName = worldName;
    const worldEl = document.getElementById('current-world');
    if (worldName) {
        worldEl.textContent = worldName;
        worldEl.title = worldName; // Show full name on hover
    } else {
        worldEl.textContent = '—';
        worldEl.title = '';
    }
}

/**
 * Update API Queue display
 */
function updateAPIQueue(size) {
    const queueEl = document.getElementById('api-queue');
    if (queueEl) {
        queueEl.textContent = size;
        // Add visual indicator when queue is active
        if (size > 0) {
            queueEl.style.color = '#ffa07a';
        } else {
            queueEl.style.color = '#00d9ff';
        }
    }
}

/**
 * Handle user cached event - update player card
 */
function handleUserCached(userId, user) {
    const player = currentPlayers.get(userId);
    if (player) {
        player.cached = true;
        player.trustRank = user.trustRank;
        console.log(`🔄 Updated player card: ${player.name} - Trust Rank: ${user.trustRank}`);
        renderPlayerCards();
    }
}

/**
 * Start session playtime timer
 */
function startSessionTimer(timestamp) {
    // Parse VRChat timestamp format: "2025.10.27 13:02:31"
    const parts = timestamp.match(/(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
        const [, year, month, day, hour, minute, second] = parts;
        sessionStartTime = new Date(year, month - 1, day, hour, minute, second);

        // Clear any existing interval
        if (playtimeInterval) {
            clearInterval(playtimeInterval);
        }

        // Update playtime every second
        playtimeInterval = setInterval(updatePlaytime, 1000);
        updatePlaytime(); // Update immediately
    }
}

/**
 * Stop session playtime timer
 */
function stopSessionTimer() {
    if (playtimeInterval) {
        clearInterval(playtimeInterval);
        playtimeInterval = null;
    }
    sessionStartTime = null;
    document.getElementById('session-playtime').textContent = '0h 0m';
}

/**
 * Update playtime display
 */
function updatePlaytime() {
    if (!sessionStartTime) {
        document.getElementById('session-playtime').textContent = '0h 0m';
        return;
    }

    const now = new Date();
    const elapsedMs = now - sessionStartTime;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;

    document.getElementById('session-playtime').textContent = `${hours}h ${minutes}m`;
}

/**
 * Add a player to the current players map
 */
async function addPlayer(playerId, playerName) {
    if (!currentPlayers.has(playerId)) {
        // Check if user is already cached with valid trust rank
        try {
            const response = await fetch(`/api/users/${playerId}`);
            if (response.ok) {
                const data = await response.json();
                const hasValidTrustRank = data.user.trustRank && data.user.trustRank !== 'unknown';
                
                currentPlayers.set(playerId, {
                    id: playerId,
                    name: playerName,
                    joinTime: new Date(),
                    cached: hasValidTrustRank,
                    trustRank: data.user.trustRank
                });
                
                console.log(`➕ Added player ${playerName}: cached=${hasValidTrustRank}, trustRank=${data.user.trustRank}`);
            } else {
                // Not cached yet
                currentPlayers.set(playerId, {
                    id: playerId,
                    name: playerName,
                    joinTime: new Date(),
                    cached: false
                });
                
                console.log(`➕ Added player ${playerName}: not cached yet`);
            }
        } catch (error) {
            console.error(`❌ Failed to fetch user ${playerId}:`, error);
            // Fallback if fetch fails
            currentPlayers.set(playerId, {
                id: playerId,
                name: playerName,
                joinTime: new Date(),
                cached: false
            });
            
            console.log(`➕ Added player ${playerName}: fetch failed, marked as not cached`);
        }
        renderPlayerCards();
    }
}

/**
 * Remove a player from the current players map
 */
function removePlayer(playerId) {
    if (currentPlayers.has(playerId)) {
        currentPlayers.delete(playerId);
        renderPlayerCards();
    }
}

/**
 * Clear all players (when switching worlds or VRChat closes)
 */
function clearAllPlayers() {
    currentPlayers.clear();
    playersCurrentPage = 1;
    renderPlayerCards();
}

/**
 * Rebuild player list from logs in current session
 */
async function rebuildPlayerListFromLogs() {
    if (!currentSessionUUID) return;

    clearAllPlayers();

    // Get all player events from current session, sorted by timestamp
    const playerEvents = allLogs
        .filter(log => 
            log.session_uuid === currentSessionUUID && 
            (log.event_type === 'Player Joined' || log.event_type === 'Player Left')
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Track which players are currently in the world
    const activePlayers = new Map();

    for (const event of playerEvents) {
        if (event.event_type === 'Player Joined') {
            activePlayers.set(event.player_id, {
                id: event.player_id,
                name: event.player_name,
                joinTime: new Date(event.timestamp),
                cached: false
            });
        } else if (event.event_type === 'Player Left') {
            activePlayers.delete(event.player_id);
        }
    }

    // Check cache status for all active players
    const cacheCheckPromises = [];
    for (const [playerId, player] of activePlayers.entries()) {
        cacheCheckPromises.push(
            fetch(`/api/users/${playerId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.user) {
                        const hasValidTrustRank = data.user.trustRank && data.user.trustRank !== 'unknown';
                        player.cached = hasValidTrustRank;
                        player.trustRank = data.user.trustRank;
                        console.log(`🔍 Rebuild check for ${player.name}: cached=${hasValidTrustRank}, trustRank=${data.user.trustRank}`);
                    }
                })
                .catch((error) => {
                    console.error(`❌ Failed to check cache for ${player.name}:`, error);
                    console.log(`🔍 Rebuild check for ${player.name}: fetch failed`);
                })
        );
    }

    // Wait for all cache checks to complete
    await Promise.all(cacheCheckPromises);

    // Update current players
    currentPlayers = activePlayers;
    renderPlayerCards();
}

/**
 * Render player cards with pagination
 */
function renderPlayerCards() {
    const playersGrid = document.getElementById('players-grid');
    const noVRChatMessage = document.getElementById('no-vrchat-message');
    const playersPageInfo = document.getElementById('players-page-info');
    const playersPrevBtn = document.getElementById('players-prev-page');
    const playersNextBtn = document.getElementById('players-next-page');

    // Show "VRChat not running" message if no VRChat session
    if (!vrchatRunning || currentPlayers.size === 0) {
        playersGrid.style.display = 'none';
        noVRChatMessage.style.display = 'block';
        playersPageInfo.textContent = 'Page 1';
        playersPrevBtn.disabled = true;
        playersNextBtn.disabled = true;
        return;
    }

    // Hide message and show grid
    noVRChatMessage.style.display = 'none';
    playersGrid.style.display = 'grid';

    // Convert map to array and sort with visitors first, then by join time
    const playersArray = Array.from(currentPlayers.values())
        .sort((a, b) => {
            // Prioritize visitors at the front
            const aIsVisitor = a.cached && a.trustRank && a.trustRank.toLowerCase() === 'visitor';
            const bIsVisitor = b.cached && b.trustRank && b.trustRank.toLowerCase() === 'visitor';
            
            if (aIsVisitor && !bIsVisitor) return -1;
            if (!aIsVisitor && bIsVisitor) return 1;
            
            // If both or neither are visitors, sort by join time (newest first)
            return b.joinTime - a.joinTime;
        });

    // Calculate pagination
    const totalPages = Math.ceil(playersArray.length / playersPerPage);
    const startIdx = (playersCurrentPage - 1) * playersPerPage;
    const endIdx = startIdx + playersPerPage;
    const playersToShow = playersArray.slice(startIdx, endIdx);

    // Clear existing cards
    playersGrid.innerHTML = '';

    // Create cards for current page
    playersToShow.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        
        const isTrulyCached = player.cached && player.trustRank && player.trustRank !== 'unknown';
        const isVisitor = isTrulyCached && player.trustRank.toLowerCase() === 'visitor';
        
        console.log(`🃏 Rendering card for ${player.name}: cached=${player.cached}, trustRank=${player.trustRank}, isTrulyCached=${isTrulyCached}`);
        
        // Apply grayed-out style if not cached
        if (!isTrulyCached) {
            card.classList.add('player-card-uncached');
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
            card.title = 'Fetching user data...';
        } else {
            card.style.cursor = 'pointer';
            card.title = 'Click to view profile';
            
            // Apply visitor styling (red color scheme)
            if (isVisitor) {
                card.classList.add('player-card-visitor');
            }
        }
        
        // Build card HTML
        let cardHTML = `<div class="player-card-name">${escapeHtml(player.name)}</div>`;
        
        if (isTrulyCached) {
            cardHTML += `<div class="player-card-rank">${escapeHtml(player.trustRank)}</div>`;
        }
        
        card.innerHTML = cardHTML;
        
        // Make card clickable only if truly cached
        if (isTrulyCached) {
            card.addEventListener('click', () => {
                window.location.href = `/user-details?userId=${encodeURIComponent(player.id)}`;
            });
        }
        
        playersGrid.appendChild(card);
    });

    // Update pagination controls
    playersPageInfo.textContent = `Page ${playersCurrentPage} of ${totalPages || 1}`;
    playersPrevBtn.disabled = playersCurrentPage <= 1;
    playersNextBtn.disabled = playersCurrentPage >= totalPages;
}

/**
 * Show "VRChat not running" message
 */
function showNoVRChatMessage() {
    const playersGrid = document.getElementById('players-grid');
    const noVRChatMessage = document.getElementById('no-vrchat-message');
    
    playersGrid.style.display = 'none';
    noVRChatMessage.style.display = 'block';
}

/**
 * Show "VRChat not running" state for both players and logs
 */
function showVRChatNotRunning() {
    // Hide players grid, show no VRChat message
    showNoVRChatMessage();
    
    // Hide logs, show VRChat not running message
    const logsContainer = document.getElementById('logs-list');
    logsContainer.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">VRChat is not currently running</div>
            <div class="empty-state-hint" style="margin-top: 10px; font-size: 14px; color: #888;">
                Start VRChat to see real-time activity
            </div>
        </div>
    `;
    updatePaginationControls();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
