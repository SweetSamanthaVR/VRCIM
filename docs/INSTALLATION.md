# Installation Guide

Complete step-by-step installation instructions for VRCIM.

## Prerequisites

### System Requirements

**Minimum:**
- Windows 10/11 (64-bit)
- Node.js 16.0.0 or higher
- 2 GB RAM
- 500 MB free disk space
- VRChat installed

**Recommended:**
- Windows 11 (64-bit)
- Node.js 20.x LTS
- 4 GB RAM
- 2 GB free disk space
- Modern browser (Chrome, Firefox, Edge)

### Optional Requirements

- **OVR Toolkit** or **XSOverlay** for VR notifications
- VR headset (for VR notifications)

## Installation Steps

### Step 1: Install Node.js

1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Choose the **LTS (Long Term Support)** version
3. Run the installer
4. Follow the installation wizard (keep default settings)

**Verify Installation:**
```powershell
node --version
# Should show: v16.0.0 or higher

npm --version
# Should show: 8.0.0 or higher
```

### Step 2: Download VRCIM

**Option A: Using Git (Recommended)**
```powershell
# Clone the repository
git clone https://github.com/SweetSamanthaVR/VRCIM.git

# Navigate to the project directory
cd VRCIM
```

**Option B: Download ZIP**
1. Go to the GitHub repository
2. Click the green "Code" button
3. Select "Download ZIP"
4. Extract the ZIP file to your desired location
5. Open PowerShell in the extracted folder

### Step 3: Install Dependencies

```powershell
npm install
```

This will install:
- `express` - Web server framework
- `ws` - WebSocket server
- `better-sqlite3` - SQLite database
- `axios` - HTTP client for VRChat API
- `ejs` - Template engine
- `typescript` - TypeScript compiler
- Type definitions for all packages

**Expected Output:**
```
added 150 packages, and audited 151 packages in 30s
```

### Step 4: Build the Project

```powershell
npm run build
```

This compiles TypeScript files from `src/` to JavaScript in `dist/`.

**Expected Output:**
```
> vrcim@1.0.0 build
> tsc
```

If no errors appear, the build was successful.

### Step 5: Configure Environment (Optional)

Create a `.env` file for custom configuration:

```powershell
# Copy the example file
Copy-Item .env.example .env

# Edit with your favorite text editor
notepad .env
```

**Basic Configuration:**
```bash
# Server settings
PORT=3000
HOST=localhost
NODE_ENV=production

# Database
DATABASE_PATH=./vrcim.db

# VR Notifications
OVRTOOLKIT_ENABLED=true
XSOVERLAY_ENABLED=true
```

See [CONFIGURATION.md](CONFIGURATION.md) for all options.

### Step 6: Start the Application

```powershell
npm start
```

**Expected Output:**
```
💾 Database initialized: vrcim.db
🔍 VRChat Monitor Service initialized
🌐 Server running at http://localhost:3000
📡 WebSocket server ready
```

### Step 7: Open the Web Interface

1. Open your web browser
2. Navigate to: http://localhost:3000
3. You should see the VRCIM dashboard

### Step 8: Authenticate with VRChat

1. Click **"Login"** in the top navigation
2. Enter your VRChat **username** (not email)
3. Enter your VRChat **password**
4. If you have 2FA enabled:
   - Open your authenticator app
   - Enter the 6-digit code
   - Click "Verify"
5. You'll be redirected to the dashboard

**Note:** Your credentials are only sent to VRChat's API and stored locally in the database.

## Verification

### Test VRChat Detection

1. Launch VRChat
2. Check the VRCIM dashboard
3. You should see "VRChat is running" status
4. Join a VRChat world
5. Watch for real-time activity updates

### Test Database

The database file should be created at `./vrcim.db`:

```powershell
# Check if database exists
Get-Item vrcim.db

# Output should show file size
```

### Test WebSocket Connection

1. Open the dashboard (http://localhost:3000)
2. Look for **"Connected"** status in the top-right corner
3. The indicator should be **green**
4. If disconnected (red), check:
   - Server is running
   - No firewall blocking localhost
   - Browser console for errors (F12)

## Troubleshooting Installation

### Error: `node` is not recognized

**Problem:** Node.js not installed or not in PATH

**Solution:**
1. Reinstall Node.js from [nodejs.org](https://nodejs.org/)
2. Ensure "Add to PATH" is checked during installation
3. Restart PowerShell/Command Prompt

### Error: `npm install` fails

**Problem:** Network issues or permissions

**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Try installing again
npm install

# If still failing, try with verbose output
npm install --verbose
```

### Error: `npm run build` fails with TypeScript errors

**Problem:** TypeScript compilation issues

**Solution:**
```powershell
# Reinstall dependencies
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install

# Try building again
npm run build
```

### Error: `Port 3000 is already in use`

**Problem:** Another application is using port 3000

**Solution:**
```powershell
# Option 1: Stop the other application
# Check what's using port 3000
netstat -ano | findstr :3000

# Option 2: Use a different port
# Create/edit .env file
PORT=3001
```

### Error: `Cannot find module 'better-sqlite3'`

**Problem:** Native module compilation failed

**Solution:**
```powershell
# Install Windows build tools (if needed)
npm install --global windows-build-tools

# Rebuild better-sqlite3
npm rebuild better-sqlite3

# Or reinstall it
npm uninstall better-sqlite3
npm install better-sqlite3
```

### VRChat Not Detected

**Problem:** VRCIM can't find VRChat logs

**Solution:**
1. Verify VRChat is installed
2. Check default log path exists:
   ```powershell
   Test-Path "$env:USERPROFILE\AppData\LocalLow\VRChat\VRChat"
   ```
3. If logs are elsewhere, add to `.env`:
   ```bash
   VRCHAT_LOG_PATH=C:/Your/Custom/Path/VRChat
   ```

## Updating VRCIM

### Using Git

```powershell
# Pull latest changes
git pull origin main

# Reinstall dependencies (if package.json changed)
npm install

# Rebuild
npm run build

# Restart the application
npm start
```

### Manual Update

1. Download the latest release
2. Extract to a new folder
3. Copy your old `.env` file (if you have one)
4. Copy your `vrcim.db` database file
5. Run `npm install` and `npm run build`
6. Start the application

## Uninstalling

### Remove Application

```powershell
# Stop the application (Ctrl+C)

# Delete the VRCIM folder
Remove-Item -Recurse -Force C:\Path\To\VRCIM
```

### Keep Database

If you want to keep your data:
```powershell
# Backup database before removing
Copy-Item vrcim.db C:\Backup\Location\
```

## Next Steps

- [Configuration Guide](CONFIGURATION.md) - Customize your settings
- [Troubleshooting](TROUBLESHOOTING.md) - Fix common issues
- [Contributing](CONTRIBUTING.md) - Help make VRCIM better

---

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue on GitHub.

