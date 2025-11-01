# Changelog

All notable changes to VRCIM (VRChat Instance Monitor) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/SweetSamanthaVR/VRCIM/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/SweetSamanthaVR/VRCIM/releases/tag/v1.0.0
