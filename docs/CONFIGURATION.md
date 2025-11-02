# Configuration Guide

Complete guide to configuring VRCIM using environment variables.

## Overview

VRCIM uses environment variables for configuration, loaded from a `.env` file in the project root.

**Configuration File:**
- **Location:** `VRCIM/.env`
- **Template:** `.env.example`
- **Format:** KEY=VALUE (one per line)
- **Security:** `.env` is gitignored (never commit it)

## Creating Your Configuration

```powershell
# Copy the example file
Copy-Item .env.example .env

# Edit with your favorite editor
notepad .env
```

## Configuration Options

### Server Configuration

#### PORT

**Description:** Port the web server listens on

**Default:** `3000`

**Valid Values:** 1-65535

**Example:**
```bash
PORT=3000
```

**Usage:**
- Access dashboard at `http://localhost:PORT`
- Change if port 3000 is already in use
- Use port 80 for `http://localhost` (requires admin on Windows)

#### HOST

**Description:** Host address the server binds to

**Default:** `localhost`

**Valid Values:**
- `localhost` - Local access only
- `0.0.0.0` - All network interfaces (allows remote access)
- Specific IP address (e.g., `192.168.1.100`)

**Example:**
```bash
HOST=localhost           # Local only
HOST=0.0.0.0            # Allow network access
```

**Security Warning:** Using `0.0.0.0` allows anyone on your network to access VRCIM. Only use on trusted networks.

#### NODE_ENV

**Description:** Node.js environment mode

**Default:** `development`

**Valid Values:**
- `development` - Shows verbose logs, dev mode
- `production` - Optimized for production
- `test` - Used for testing

**Example:**
```bash
NODE_ENV=production
```

**Effect:**
- Development: More console logging, config displayed
- Production: Cleaner logs, better performance

**IMPORTANT - WebSocket Protocol in Production:**

When using `NODE_ENV=production` **without HTTPS**, the WebSocket settings will auto-detect and use `ws://` (not `wss://`). 

❌ **Common Mistake:**
```bash
NODE_ENV=production
# Missing WS_PROTOCOL - will auto-detect correctly!
```

✅ **Correct - Auto-Detection (Recommended):**
```bash
NODE_ENV=production
# Leave WebSocket settings commented out - they auto-detect!
```

The application automatically detects the correct protocol from your browser URL:
- Accessing via `http://` → Uses `ws://`
- Accessing via `https://` → Uses `wss://`

**Only set `WS_PROTOCOL` manually if you have an advanced reverse proxy setup.**

#### LOG_LEVEL

**Description:** Control the verbosity of console logging output

**Default:** `DEBUG` in development, `INFO` in production

**Valid Values:**
- `DEBUG` - Show all log messages (most verbose)
- `INFO` - Show informational, warning, and error messages
- `WARN` - Show only warnings and errors
- `ERROR` - Show only error messages
- `NONE` - Suppress all log messages

**Example:**
```bash
LOG_LEVEL=INFO
```

**Usage:**
- Use `DEBUG` when troubleshooting issues
- Use `INFO` for normal operation
- Use `WARN` or `ERROR` to reduce console noise
- Use `NONE` to completely disable console logging

#### ENABLE_CONSOLE_LOGS

**Description:** Enable or disable all console logging output

**Default:** `true`

**Valid Values:**
- `true` - Enable console logging
- `false` - Disable all console output

**Example:**
```bash
ENABLE_CONSOLE_LOGS=false
```

**Usage:**
- Set to `false` to completely suppress console output
- Useful when running as a background service
- Can be combined with `LOG_LEVEL` for fine-grained control
- When disabled, overrides `LOG_LEVEL` setting

**Note:** Disabling console logs does not affect the application's functionality, only the visibility of log messages.

### Database Configuration

#### DATABASE_PATH

**Description:** Path to SQLite database file

**Default:** `./vrcim.db`

**Valid Values:** Any valid file path (relative or absolute)

**Examples:**
```bash
# Relative path (recommended)
DATABASE_PATH=./vrcim.db

# Absolute path
DATABASE_PATH=C:/Users/YourName/Documents/VRCIM/data.db

# Different filename
DATABASE_PATH=./vrcim_data.db
```

**Notes:**
- Database is created automatically if it doesn't exist
- Relative paths are relative to project root
- Ensure directory has write permissions
- Backup this file regularly (contains all your data)

### VRChat Configuration

#### VRCHAT_LOG_PATH

**Description:** Path to VRChat log directory

**Default:** `%USERPROFILE%/AppData/LocalLow/VRChat/VRChat` (auto-detected)

**Valid Values:** Any valid directory path

**Examples:**
```bash
# Usually not needed (auto-detected)
# Uncomment only if VRChat logs are in a custom location
VRCHAT_LOG_PATH=C:/Users/YourName/AppData/LocalLow/VRChat/VRChat

# Custom location
VRCHAT_LOG_PATH=D:/VRChat/Logs
```

**When to set:**
- VRChat installed in custom location
- Using portable VRChat installation
- Logs moved to different drive
- Testing with log files from another computer

### WebSocket Configuration

These settings control how the frontend connects to the backend WebSocket server for real-time updates. Most users won't need to modify these settings as they are automatically configured.

#### WS_PROTOCOL

**Description:** WebSocket protocol (ws or wss)

**Default:** `ws` in development, `wss` in production (auto-detected)

**Valid Values:**
- `ws` - Unencrypted WebSocket
- `wss` - Encrypted WebSocket (requires HTTPS)

**Example:**
```bash
WS_PROTOCOL=ws
```

**Note:** Only use `wss` if you've set up HTTPS with SSL certificates.

#### WS_HOST

**Description:** WebSocket server host (advanced users only)

**Default:** Auto-detected from current page URL (recommended)

**Example:**
```bash
# Only set this if you need a specific WebSocket host
# WS_HOST=192.168.1.100
```

**Important:** In most cases, you should NOT set this value. When left unset (commented out), the application automatically uses the same hostname that you use to access the web interface. This ensures WebSocket connections work correctly whether you access via:
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://192.168.1.100:3000` (your local IP)
- `http://your-computer-name:3000`

**When to set:**
- Advanced setups with reverse proxies
- WebSocket server on different host than web server
- Special networking configurations

**Common Issues:**
If users experience WebSocket connection timeouts, ensure `WS_HOST` is NOT set in your `.env` file. Remove or comment out the line to enable automatic detection.

#### WS_PORT

**Description:** WebSocket server port

**Default:** Same as `PORT` setting

**Example:**
```bash
WS_PORT=3000
```

**Note:** Only change if WebSocket runs on different port than HTTP server.

### VR Notification Configuration

#### OVRTOOLKIT_ENABLED

**Description:** Enable/disable OVR Toolkit notifications

**Default:** `true`

**Valid Values:**
- `true` - Enable notifications
- `false` - Disable notifications

**Example:**
```bash
OVRTOOLKIT_ENABLED=true
```

**Requirements:**
- [OVR Toolkit](https://store.steampowered.com/app/1068820/OVR_Toolkit/) must be running
- Connects via WebSocket on localhost:7730

#### XSOVERLAY_ENABLED

**Description:** Enable/disable XSOverlay notifications

**Default:** `true`

**Valid Values:**
- `true` - Enable notifications
- `false` - Disable notifications

**Example:**
```bash
XSOVERLAY_ENABLED=true
```

**Requirements:**
- [XSOverlay](https://store.steampowered.com/app/1173510/XSOverlay/) must be running
- Sends via UDP to localhost:42069

**Note:** You can enable both. VRCIM will send to whichever is running.
### Pagination & Display Configuration

Control how many items are shown per page across different UI sections.

#### PLAYERS_PER_PAGE

**Description:** Number of player cards to show per page in the "Players in Instance" section.

**Default:** `20`

**Valid Values:** `1-200`

**Example:**
```bash
PLAYERS_PER_PAGE=24
```

**Notes:** Higher values may increase page height and reduce clarity. Visitors are prioritized visually.

#### RECENT_ACTIVITY_LIMIT

**Description:** Number of recent log entries (world + player events) fetched from backend and supplied to the dashboard.

**Default:** `50`

**Valid Values:** `1-1000`

**Example:**
```bash
RECENT_ACTIVITY_LIMIT=100
```

**Usage:** Affects initial WebSocket payload and `/api/logs` default limit when the `limit` query parameter is not provided.

#### CACHED_USERS_PER_PAGE

**Description:** Number of cached user profiles shown per page on the Cached Users screen.

**Default:** `50`

**Valid Values:** `1-500`

**Example:**
```bash
CACHED_USERS_PER_PAGE=75
```

**Notes:** Frontend pagination uses this value. Very large values can impact scroll performance.

## Configuration Examples

### Example 1: Default Local Setup

```bash
# Minimal configuration for local use
PORT=3000
NODE_ENV=production
DATABASE_PATH=./vrcim.db
OVRTOOLKIT_ENABLED=true
XSOVERLAY_ENABLED=true
LOG_LEVEL=INFO
```

### Example 2: Network Access

```bash
# Allow access from other devices on your network
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_PATH=./vrcim.db
# Do NOT set WS_HOST - let it auto-detect!
```

Access from other devices at: `http://YOUR_IP:3000`

**Important:** Do not set `WS_HOST` when allowing network access. The application will automatically use the correct hostname.

### Example 3: Custom Paths

```bash
# Custom database and VRChat log locations
PORT=3000
NODE_ENV=production
DATABASE_PATH=D:/VRCIM_Data/database.db
VRCHAT_LOG_PATH=D:/VRChat/Logs
```

### Example 4: Development Mode

```bash
# Development configuration with verbose logging
PORT=3001
HOST=localhost
NODE_ENV=development
DATABASE_PATH=./dev_database.db
LOG_LEVEL=DEBUG
```

### Example 5: Disable VR Notifications

```bash
# If you don't use VR or want to disable notifications
PORT=3000
NODE_ENV=production
OVRTOOLKIT_ENABLED=false
XSOVERLAY_ENABLED=false
```

### Example 6: Silent Background Service

```bash
# Run as background service with minimal console output
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_PATH=./vrcim.db
LOG_LEVEL=ERROR
ENABLE_CONSOLE_LOGS=true
```

### Example 7: Completely Silent Operation

```bash
# Completely disable console logging
PORT=3000
NODE_ENV=production
DATABASE_PATH=./vrcim.db
ENABLE_CONSOLE_LOGS=false
```

## Advanced Configuration

### Using Different Ports for Different Instances

You can run multiple VRCIM instances with different configurations:

**Instance 1 (.env):**
```bash
PORT=3000
DATABASE_PATH=./instance1.db
```

**Instance 2 (.env.test):**
```bash
PORT=3001
DATABASE_PATH=./instance2.db
```

Run second instance:
```powershell
# Specify different env file
$env:NODE_ENV="test"
npm start
```

### Environment-Specific Configs

**Development:**
```bash
NODE_ENV=development
PORT=3001
DATABASE_PATH=./dev_db.db
```

**Production:**
```bash
NODE_ENV=production
PORT=3000
DATABASE_PATH=./vrcim.db
```

### Security Considerations

**Never commit `.env` files:**
```bash
# .env is already in .gitignore
# Double-check it's not tracked:
git status
```

**Protect your `.env` file:**
```powershell
# Make .env read-only (optional)
Set-ItemProperty .env -Name IsReadOnly -Value $true

# Remove read-only (to edit):
Set-ItemProperty .env -Name IsReadOnly -Value $false
```

**Backup sensitive data:**
```powershell
# Backup .env (store securely)
Copy-Item .env .env.backup

# Do NOT commit .env.backup to git!
```

## Troubleshooting Configuration

### Configuration Not Loading

**Problem:** Changes to `.env` not taking effect

**Solution:**
1. Ensure file is named exactly `.env` (not `.env.txt`)
2. Restart the application (Ctrl+C, then `npm start`)
3. Check for syntax errors (no spaces around `=`)

### Invalid Configuration Values

**Problem:** Application fails to start with config error

**Solution:**
1. Check PORT is a number between 1-65535
2. Ensure paths exist and have correct format
3. Boolean values must be exactly `true` or `false`
4. Remove extra spaces or quotes

### WebSocket Connection Timeouts

**Problem:** Web UI shows "Disconnected" or connection timeouts, but console logging works

**Common Scenarios:**

#### Scenario 1: Using NODE_ENV=production without HTTPS

**Symptoms:**
- Works fine with `NODE_ENV=development`
- Fails with `NODE_ENV=production`
- Browser console shows WebSocket connection errors

**Root Cause:**
The application now auto-detects the correct WebSocket protocol from your browser URL, so this should work automatically.

**Solution:**
1. **Ensure ALL WebSocket settings are commented out in `.env`:**
   ```bash
   # ✅ CORRECT - All commented out (auto-detect enabled)
   # WS_PROTOCOL=ws
   # WS_HOST=localhost
   # WS_PORT=3000
   ```

2. **If you previously uncommented these, comment them back:**
   ```bash
   # ❌ WRONG - These override auto-detection
   WS_PROTOCOL=ws
   WS_HOST=localhost
   ```

3. **Restart the application:**
   ```powershell
   # Stop with Ctrl+C, then:
   npm run build
   npm start
   ```

#### Scenario 2: Explicitly Set WS_HOST

**Problem:** `WS_HOST` is set in `.env`

**Solution:**
1. **Check if `WS_HOST` is set in `.env`**
   ```bash
   # WRONG - This will cause connection timeouts:
   WS_HOST=localhost
   
   # CORRECT - Comment out or remove this line:
   # WS_HOST=localhost
   ```

2. **Let the application auto-detect the correct WebSocket URL:**
   - The application automatically uses the same hostname from your browser's address bar
   - This works correctly whether accessing via `localhost`, IP address, or computer name

3. **Verify WebSocket connection in browser:**
   - Open browser console (F12)
   - Look for WebSocket connection errors
   - Should see: `✓ Configuration loaded:` with `wsUrl: "auto"`

4. **Restart the application after making changes:**
   ```powershell
   # Stop with Ctrl+C, then:
   npm start
   ```

**Root Cause:** When WebSocket settings are explicitly set, they override the auto-detection. The auto-detection ensures the browser connects using the same protocol (HTTP→WS, HTTPS→WSS) and host (localhost, IP, or hostname) as the page URL.

### File Path Issues

**Problem:** Database or log path not found

**Solution:**
```powershell
# Use forward slashes or escaped backslashes
DATABASE_PATH=C:/Users/Name/Documents/data.db
# Or
DATABASE_PATH=C:\\Users\\Name\\Documents\\data.db

# Relative paths start from project root
DATABASE_PATH=./data/vrcim.db
```

### Port Already in Use

**Problem:** `Error: Port 3000 is already in use`

**Solution:**
```bash
# Change to different port
PORT=3001
```

Or stop the application using port 3000:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
Stop-Process -Id PID -Force
```

## Configuration Validation

VRCIM validates configuration on startup:

**Valid Configuration:**
```
✓ Configuration loaded successfully
  Server: http://localhost:3000
  Database: ./vrcim.db
  VRChat Logs: C:/Users/Name/AppData/.../VRChat
  OVR Toolkit: Enabled
  XSOverlay: Enabled
```

**Invalid Configuration:**
```
✗ Configuration error: PORT must be between 1 and 65535
✗ Configuration error: DATABASE_PATH directory does not exist
```

## Default Values

If no `.env` file exists, these defaults are used:

| Setting | Default Value |
|---------|--------------|
| PORT | 3000 |
| HOST | localhost |
| NODE_ENV | development |
| DATABASE_PATH | ./vrcim.db |
| VRCHAT_LOG_PATH | (auto-detected) |
| OVRTOOLKIT_ENABLED | true |
| XSOVERLAY_ENABLED | true |

## Next Steps

- [Installation Guide](INSTALLATION.md) - Get set up
- [Troubleshooting](TROUBLESHOOTING.md) - Fix common issues
- [Security Guide](SECURITY.md) - Keep your setup secure

---

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue on GitHub.

