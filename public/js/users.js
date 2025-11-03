/**
 * Users List Page JavaScript (users.ejs)
 * Handles displaying, searching, and filtering cached users
 * Dependencies: common.js (for shared utilities like escapeHtml, formatTimestamp, getTrustRankClass)
 * 
 * ⚠️ NOTE: This file contains HTML templates for dynamically creating user cards.
 * The HTML structure in createUserCard() function below defines how each user card looks.
 * If you need to modify the user card layout, look for the createUserCard() function.
 * Static page structure is in views/users.ejs
 */

// State management
let allUsers = [];
let filteredUsers = [];
let totalUsersCount = 0; // Total count from server for pagination
let currentFilter = 'all';
let currentPage = 1;
let USERS_PER_PAGE = 50; // Will be loaded from config

// Virtual scrolling configuration
const CARD_HEIGHT = 150; // Approximate height of each user card in pixels
const BUFFER_SIZE = 5; // Number of cards to render above/below viewport
let virtualScrollState = {
    scrollTop: 0,
    viewportHeight: 0,
    totalHeight: 0,
    startIndex: 0,
    endIndex: 0,
    isEnabled: false
};

/**
 * Initialize users page
 */
async function init() {
    // Load configuration first
    try {
        USERS_PER_PAGE = await getCachedUsersPerPage();
        console.log(`✓ Cached users per page: ${USERS_PER_PAGE}`);
    } catch (error) {
        console.warn('⚠ Failed to load cached users per page config, using default:', error);
        USERS_PER_PAGE = 50;
    }
    
    setupEventListeners();
    loadUsers();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            currentPage = 1; // Reset to first page on search
            applyFilters(searchTerm, currentFilter);
        }, 300));
    }

    // Retry button for error state
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            loadUsers();
        });
    }

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Update active tab
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            // Apply filter
            currentFilter = e.target.dataset.filter;
            currentPage = 1; // Reset to first page on filter change
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            applyFilters(searchTerm, currentFilter);
        });
    });

    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadUsers(); // Reload from server with new page
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        // Use totalUsersCount for server-side pagination, or filteredUsers.length for client-side filtering
        const isFiltering = currentFilter !== 'all' || (document.getElementById('searchInput')?.value || '').trim() !== '';
        const totalCount = isFiltering ? filteredUsers.length : totalUsersCount;
        const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);
        
        if (currentPage < totalPages) {
            currentPage++;
            loadUsers(); // Reload from server with new page
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Virtual scrolling - setup scroll listener for users grid
    setupVirtualScrolling();
}

/**
 * Load users from API with server-side pagination
 */
async function loadUsers() {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const noResultsState = document.getElementById('no-results-state');
    const usersGrid = document.getElementById('users-grid');
    
    // Show loading, hide others
    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    noResultsState.style.display = 'none';
    usersGrid.style.display = 'none';

    try {
        // Calculate offset based on current page
        const offset = (currentPage - 1) * USERS_PER_PAGE;
        
        // Fetch users with server-side pagination (50 per page)
        const response = await fetch(`/api/users/cached?limit=${USERS_PER_PAGE}&offset=${offset}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        allUsers = data.users || [];
        
        // Store total count for pagination
        totalUsersCount = data.pagination?.total || allUsers.length;
        updateStatsSummary(totalUsersCount);
        
        // For server-side pagination, filteredUsers is the same as allUsers
        filteredUsers = allUsers;
        
        // Apply search/filter (will need to reload from server if filtering)
        const searchTerm = document.getElementById('searchInput')?.value || '';
        if (searchTerm || currentFilter !== 'all') {
            // If search/filter is active, fall back to client-side filtering
            // by loading all users (we'll optimize this in a future update)
            await loadAllUsersForFiltering();
        } else {
            // No filtering, display current page
            displayCurrentPage();
        }
    } catch (error) {
        console.error('❌ Error loading users:', error);
        
        // Show error state
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        document.getElementById('error-message').textContent = escapeHtml(error.message);
        
        // Also display global error message
        displayErrorMessage('Failed to Load Users', error.message);
    }
}

/**
 * Load all users for client-side filtering (fallback for search/filter)
 */
async function loadAllUsersForFiltering() {
    try {
        const response = await fetch('/api/users/cached?limit=1000&offset=0');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        allUsers = data.users || [];
        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        applyFilters(searchTerm, currentFilter);
    } catch (error) {
        console.error('❌ Error loading all users:', error);
        displayErrorMessage('Failed to Load Users', error.message);
    }
}

/**
 * Update statistics summary
 */
function updateStatsSummary(totalUsers) {
    const totalUsersEl = document.getElementById('totalUsers');
    if (totalUsersEl) {
        totalUsersEl.textContent = totalUsers;
    }
}

/**
 * Apply search and filter
 */
function applyFilters(searchTerm, filter) {
    let filtered = allUsers;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(user => {
            const displayName = (user.displayName || '').toLowerCase();
            const username = (user.username || '').toLowerCase();
            const userId = (user.id || '').toLowerCase();
            return displayName.includes(searchTerm) || 
                   username.includes(searchTerm) || 
                   userId.includes(searchTerm);
        });
    }

    // Apply trust rank filter
    if (filter !== 'all') {
        filtered = filtered.filter(user => {
            const userRank = getTrustRankClass(user.trustRank);
            return userRank === filter;
        });
    }

    filteredUsers = filtered;
    currentPage = 1; // Reset to first page
    displayCurrentPage();
}

/**
 * Display current page of users
 */
function displayCurrentPage() {
    // For server-side pagination (no filtering), display all users from current fetch
    // For client-side filtering, slice the filtered results
    const isFiltering = currentFilter !== 'all' || (document.getElementById('searchInput')?.value || '').trim() !== '';
    
    let usersToDisplay;
    if (isFiltering) {
        // Client-side pagination when filtering
        const startIndex = (currentPage - 1) * USERS_PER_PAGE;
        const endIndex = startIndex + USERS_PER_PAGE;
        usersToDisplay = filteredUsers.slice(startIndex, endIndex);
    } else {
        // Server-side pagination (all users from allUsers are already the right page)
        usersToDisplay = allUsers;
    }
    
    // Enable virtual scrolling if we have many users
    virtualScrollState.isEnabled = filteredUsers.length > 100;
    
    displayUsers(usersToDisplay);
    updatePagination();
}

/**
 * Setup virtual scrolling for large lists
 */
function setupVirtualScrolling() {
    const usersGrid = document.getElementById('users-grid');
    if (!usersGrid) return;

    // Use throttled scroll handler for performance
    const handleScroll = throttle(() => {
        if (!virtualScrollState.isEnabled) return;
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const viewportHeight = window.innerHeight;
        
        virtualScrollState.scrollTop = scrollTop;
        virtualScrollState.viewportHeight = viewportHeight;
        
        updateVirtualScroll();
    }, 16); // ~60fps

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
}

/**
 * Calculate which items should be visible in viewport
 */
function updateVirtualScroll() {
    if (!virtualScrollState.isEnabled) return;

    const usersGrid = document.getElementById('users-grid');
    if (!usersGrid) return;

    const gridRect = usersGrid.getBoundingClientRect();
    const gridTop = gridRect.top + window.pageYOffset;
    
    // Calculate approximate rows based on grid width
    const gridWidth = gridRect.width;
    const cardWidth = 250; // minmax(250px, 1fr) from CSS
    const gap = 16; // var(--spacing-md)
    const columnsPerRow = Math.floor((gridWidth + gap) / (cardWidth + gap)) || 1;
    
    // Calculate which items are in viewport
    const scrollOffset = virtualScrollState.scrollTop - gridTop;
    const rowHeight = CARD_HEIGHT + gap;
    const startRow = Math.max(0, Math.floor(scrollOffset / rowHeight) - BUFFER_SIZE);
    const endRow = Math.ceil((scrollOffset + virtualScrollState.viewportHeight) / rowHeight) + BUFFER_SIZE;
    
    const startIndex = startRow * columnsPerRow;
    const endIndex = Math.min(filteredUsers.length, (endRow + 1) * columnsPerRow);
    
    // Only update if indices changed significantly
    if (Math.abs(startIndex - virtualScrollState.startIndex) > columnsPerRow * 2 ||
        Math.abs(endIndex - virtualScrollState.endIndex) > columnsPerRow * 2) {
        
        virtualScrollState.startIndex = startIndex;
        virtualScrollState.endIndex = endIndex;
        
        renderVirtualItems();
    }
}

/**
 * Render only visible items for virtual scrolling
 */
function renderVirtualItems() {
    const usersGrid = document.getElementById('users-grid');
    if (!usersGrid) return;

    const visibleUsers = filteredUsers.slice(
        virtualScrollState.startIndex,
        virtualScrollState.endIndex
    );

    // Calculate total height and offset
    const gridWidth = usersGrid.offsetWidth;
    const cardWidth = 250;
    const gap = 16;
    const columnsPerRow = Math.floor((gridWidth + gap) / (cardWidth + gap)) || 1;
    const totalRows = Math.ceil(filteredUsers.length / columnsPerRow);
    const rowHeight = CARD_HEIGHT + gap;
    
    virtualScrollState.totalHeight = totalRows * rowHeight;
    
    const startRow = Math.floor(virtualScrollState.startIndex / columnsPerRow);
    const offsetTop = startRow * rowHeight;

    // Create HTML for visible items with proper offset
    const usersHtml = visibleUsers.map(user => createUserCard(user)).join('');
    
    // Apply content with spacers to maintain scroll position
    usersGrid.innerHTML = `
        <div class="virtual-spacer-top" style="height: ${offsetTop}px; grid-column: 1 / -1;"></div>
        ${usersHtml}
        <div class="virtual-spacer-bottom" style="height: ${Math.max(0, virtualScrollState.totalHeight - offsetTop - (visibleUsers.length * rowHeight / columnsPerRow))}px; grid-column: 1 / -1;"></div>
    `;
}

/**
 * Update pagination controls
 */
function updatePagination() {
    // Use totalUsersCount for server-side pagination, or filteredUsers.length for client-side filtering
    const isFiltering = currentFilter !== 'all' || (document.getElementById('searchInput')?.value || '').trim() !== '';
    const totalCount = isFiltering ? filteredUsers.length : totalUsersCount;
    const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);
    
    const paginationDiv = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (totalPages <= 1) {
        paginationDiv.style.display = 'none';
    } else {
        paginationDiv.style.display = 'flex';
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

/**
 * Display users in grid
 */
function displayUsers(users) {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const noResultsState = document.getElementById('no-results-state');
    const usersGrid = document.getElementById('users-grid');

    // Hide loading and error states
    loadingState.style.display = 'none';
    errorState.style.display = 'none';

    if (filteredUsers.length === 0) {
        // Show no results state
        noResultsState.style.display = 'block';
        usersGrid.style.display = 'none';
        
        const noResultsHint = document.getElementById('no-results-hint');
        if (currentFilter !== 'all' || document.getElementById('searchInput').value) {
            noResultsHint.textContent = 'Try adjusting your search or filters.';
        } else {
            noResultsHint.textContent = '';
        }
        return;
    }

    // Hide no results, show grid
    noResultsState.style.display = 'none';
    usersGrid.style.display = 'grid';

    // Use virtual scrolling for large lists
    if (virtualScrollState.isEnabled) {
        // Initialize virtual scroll state
        virtualScrollState.scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        virtualScrollState.viewportHeight = window.innerHeight;
        virtualScrollState.startIndex = 0;
        virtualScrollState.endIndex = Math.min(100, filteredUsers.length);
        
        renderVirtualItems();
    } else {
        // Normal rendering for small lists
        const usersHtml = users.map(user => createUserCard(user)).join('');
        usersGrid.innerHTML = usersHtml;
    }
}

/**
 * Create HTML for a user card
 */
function createUserCard(user) {
    const displayName = escapeHtml(user.displayName || user.username || 'Unknown');
    const username = escapeHtml(user.username || user.displayName || 'Unknown');
    const trustRankClass = getTrustRankClass(user.trustRank);
    const trustRank = escapeHtml(user.trustRank || 'Visitor');
    const encounters = user.timesEncountered || 1;
    const firstSeen = formatTimestamp(user.firstSeen);

    return `
        <a href="/user-details?userId=${escapeHtml(user.id)}" class="user-card">
            <div class="user-card-header">
                <div class="user-card-info">
                    <div class="user-card-name">${displayName}</div>
                    <div class="user-card-username">@${username}</div>
                    <span class="user-card-rank ${trustRankClass}">${trustRank}</span>
                </div>
            </div>
            <div class="user-card-stats">
                <div class="user-card-stat">
                    <div class="user-card-stat-value">${encounters}</div>
                    <div class="user-card-stat-label">Encounters</div>
                </div>
                <div class="user-card-stat">
                    <div class="user-card-stat-value" style="font-size: 0.9em;">${firstSeen}</div>
                    <div class="user-card-stat-label">First Seen</div>
                </div>
            </div>
        </a>
    `;
}

/**
 * Format timestamp for display (date only)
 */
function formatTimestampDateOnly(timestamp) {
    if (!timestamp) return 'Unknown';
    
    // Handle VRChat log format: "2025.10.27 20:03:51"
    // Convert to ISO format: "2025-10-27T20:03:51"
    const isoTimestamp = timestamp.replace(/\./g, '-').replace(' ', 'T');
    const date = new Date(isoTimestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return timestamp; // Return original if can't parse
    }
    
    return date.toLocaleDateString();
}

// Initialize page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
