# Changelog

All notable changes to VRCIM (VRChat Instance Monitor) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-11-03

### Added
- **Configurable Pagination Settings**: Added three new environment variables for customizable pagination
  - `PLAYERS_PER_PAGE` (1-200, default: 20) - Controls players shown per page in "Players in Instance" section
  - `RECENT_ACTIVITY_LIMIT` (1-1000, default: 50) - Number of recent activity log entries fetched for dashboard and `/api/logs` endpoint
  - `CACHED_USERS_PER_PAGE` (1-500, default: 50) - Cached user profiles displayed per page in Users list
  - All settings have validation with min/max bounds enforcement
  - Settings are dynamically loaded by frontend from `/api/config` endpoint

### Changed
- Enhanced `/api/config` endpoint to expose pagination configuration to frontend
- Updated dashboard, users list, and monitor pages to use dynamic pagination values
- Modified WebSocket initial data to respect `RECENT_ACTIVITY_LIMIT` configuration
- Improved configuration system with runtime validation and fallback defaults

### Technical Details
- Modified `src/config.ts` to parse and validate new pagination settings
- Updated `AppConfig` interface with three new pagination properties
- Enhanced `public/js/config.js` with helper functions: `getPlayersPerPage()`, `getRecentActivityLimit()`, `getCachedUsersPerPage()`
- Modified `public/js/monitor.js` and `public/js/users.js` to load config asynchronously on initialization
- Updated `.env.example` with comprehensive documentation for new settings

## [1.2.1] - 2025-11-01

### Changed
- **Users Page Pagination**: Improved pagination system to use server-side pagination
  - Limits display to 50 users per page
  - Fetches only the current page from the database (instead of loading 1000+ users)
  - Improved performance for large user databases
  - Search and filter functionality still uses client-side filtering for best UX
  - Pagination controls automatically hide when not needed

### Technical Details
- Modified frontend to request paginated data from `/api/users/cached` endpoint
- Updated pagination logic to calculate total pages from server-provided count
- Optimized data loading to reduce memory usage and improve page load times

## [1.2.0] - 2025-11-01

### Added
- **Nuisance Player Detection**: Automatic detection and VR notification for players with VRChat-applied nuisance tags
  - Detects `system_troll` tag (confirmed nuisance player)
  - Detects `system_probable_troll` tag (probable nuisance player)
  - Sends in-game VR notification when nuisance player joins: "🚨 [username] has joined and has a nuisance tag applied by VRChat — be alert"
  - Nuisance notifications take priority over visitor notifications
  - Console logging includes nuisance player warnings
- New `isNuisance` and `nuisanceType` properties in `EnrichedUser` interface
- Reference implementation based on VRCX's nuisance detection system

### Changed
- Enhanced `VRChatAPIClient.enrichUserData()` to detect nuisance tags
- Updated `VRNotificationService` with `sendNuisanceNotification()` method
- Modified player join notification logic to prioritize nuisance alerts

### Technical Details
- Added `detectNuisancePlayer()` method to VRChat API client
- Tags checked: `system_troll`, `system_probable_troll`
- VRCX repository added to `.gitignore` (for reference only, not included in commits)

## [1.1.0] - 2025-11-01

### Added
- **VR Notification Control**: Added pause/resume button for in-game notifications
  - New button in the web UI (Players in Instance section) to pause/resume VR notifications
  - Real-time sync across all connected browser tabs via WebSocket
  - Notifications can be paused without stopping the application
  - Visual feedback with icon and text changes (🔔 Notifications On / 🔕 Notifications Off)
  - Fully responsive design for mobile devices
- New API endpoints for notification control:
  - `GET /api/notifications/status` - Get current notification status
  - `POST /api/notifications/pause` - Pause VR notifications
  - `POST /api/notifications/resume` - Resume VR notifications

### Changed
- Enhanced `VRNotificationService` with pause/resume functionality
- Updated WebSocket protocol to broadcast notification status changes
- Improved section header layout to accommodate notification button

### Technical Details
- Modified `src/vrNotificationService.ts` with pause/resume methods
- Updated `src/webserver.ts` with notification control endpoints
- Enhanced `src/monitor.ts` to expose VR notification service
- Added UI controls in `views/index.ejs` and `public/js/monitor.js`
- Styled notification button in `public/css/monitor.css` with mobile responsiveness

## [1.0.1] - 2025-11-01

### Fixed
- **Critical**: Fixed WebSocket connection timeout when using `NODE_ENV=production` without HTTPS
  - WebSocket protocol now auto-detects from browser URL (HTTP→WS, HTTPS→WSS)
  - WebSocket host now auto-detects from browser URL (works with localhost, IP addresses, and hostnames)
  - Removed hardcoded WebSocket configuration that caused mixed content errors
  - Users no longer need to manually configure `WS_PROTOCOL`, `WS_HOST`, or `WS_PORT` in most scenarios

### Added
- Console logging control via `ENABLE_CONSOLE_LOGS` environment variable
  - Set to `false` to suppress all console output
  - Useful for running as a background service or reducing console noise
  - Works in conjunction with existing `LOG_LEVEL` setting
- Comprehensive documentation for WebSocket auto-detection in `CONFIGURATION.md`
- Troubleshooting section for `NODE_ENV=production` WebSocket connection issues

### Changed
- WebSocket configuration now defaults to automatic detection instead of manual settings
- Updated `.env.example` with clearer documentation about WebSocket auto-detection
- Enhanced logger class with console output toggle functionality
- Improved configuration documentation with production mode examples

### Technical Details
- Modified `src/config.ts` `getWebSocketUrl()` to return `'auto'` when WebSocket settings are not explicitly configured
- Enhanced `public/js/config.js` to dynamically construct WebSocket URLs from `window.location`
- Updated `src/logger.ts` with `consoleLogsEnabled` property and related methods

## [1.0.0] - 2025-10-30

### Added

#### Core Features
- Real-time VRChat process and log file monitoring
- Complete player encounter tracking with timestamps
- World activity recording with session UUIDs
- VRChat API integration with rate limiting (60 req/min)
- Automatic Visitor profile refresh detection
- SQLite database with persistent storage and transactions
- Real-time WebSocket updates for live dashboard
- Modern responsive web UI with dark theme
- Mobile-responsive layout with touch-friendly controls

#### Security
- Comprehensive input validation middleware for all API endpoints
- XSS protection with Content-Security-Policy headers
- SQL injection prevention with parameterized queries
- Authentication token validation with expiry checks
- Environment-based configuration system with `.env` support
- Secure credential storage and validation
- Additional security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)

#### VR Integration
- OVR Toolkit notification support via WebSocket
- XSOverlay notification support via UDP
- 10-second visitor notifications with display names
- Automatic overlay detection

#### User Interface
- Dashboard with real-time monitoring feed
- Users list with trust rank filtering and search
- User details page with complete encounter history
- Login page with VRChat authentication
- Accessible keyboard navigation
- WCAG AAA compliant touch targets (44x44px)
- Focus states for better accessibility

#### API
- RESTful API for user data and session management
- WebSocket API for real-time updates
- Session validation and authentication endpoints
- User search with debounced filtering (300ms)
- Trust rank filtering system

#### Performance
- Database indexes on frequently queried columns
- SQL LIMIT clauses to prevent unbounded queries
- Virtual scrolling for large user lists
- Log file streaming instead of full file reads
- WebSocket reconnection with exponential backoff

#### Error Handling
- Global error handler for unhandled exceptions
- Database operation error handling with transactions
- Frontend error boundaries with user-friendly messages
- API error responses with proper HTTP status codes
- WebSocket reconnection on connection failures

#### Documentation
- Comprehensive README with quick start guide
- Installation guide with detailed setup instructions
- Configuration guide for environment variables
- Troubleshooting guide for common issues
- Contributing guidelines for contributors
- Security policy for responsible disclosure
- API documentation with REST and WebSocket endpoints
- MIT License included
- EditorConfig for consistent code formatting

#### Code Quality
- TypeScript with strict mode enabled
- Comprehensive code comments and documentation
- Input validation on all user inputs
- Proper error boundaries and exception handling
- Consistent code formatting with EditorConfig
- No duplicate or legacy files

### Changed
- Refactored README into modular documentation structure
- Improved error messages for better user understanding
- Enhanced mobile layout with responsive breakpoints (768px, 480px)
- Optimized database queries with proper indexing

### Security
- Added input validation to prevent SQL injection
- Implemented XSS protection with CSP headers
- Added authentication token validation with expiry
- Secured environment configuration system
- Added rate limiting for VRChat API requests

### Fixed
- Database transaction handling for data integrity
- Frontend error handling for better user experience
- WebSocket reconnection logic for stability
- Mobile layout issues with responsive design
- Touch target sizing for accessibility

### Technical Details

#### Dependencies
- Node.js 16.0.0 or higher
- TypeScript 5.3.0
- Express 5.1.0
- better-sqlite3 12.4.1
- ws 8.18.3
- axios 1.13.0
- ejs 3.1.10

#### System Requirements
- Windows 10/11 (64-bit)
- 2GB RAM minimum
- VRChat installed and running

---

**Note**: This is the initial release of VRCIM. For future updates, changes will be documented following the categories: Added, Changed, Deprecated, Removed, Fixed, and Security.

[1.3.0]: https://github.com/SweetSamanthaVR/VRCIM/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/SweetSamanthaVR/VRCIM/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/SweetSamanthaVR/VRCIM/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SweetSamanthaVR/VRCIM/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/SweetSamanthaVR/VRCIM/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/SweetSamanthaVR/VRCIM/releases/tag/v1.0.0
