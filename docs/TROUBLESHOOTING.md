# Troubleshooting Guide

Common issues and solutions for VRCIM.

## Quick Diagnostic

Before diving into specific issues, run these quick checks:

```powershell
# 1. Check Node.js version
node --version
# Should be v16.0.0 or higher

# 2. Check if VRCIM is running
netstat -ano | findstr :3000

# 3. Check VRChat is running
Get-Process VRChat -ErrorAction SilentlyContinue

# 4. Check database exists
Test-Path vrcim.db

# 5. Rebuild project
npm run build
```

---

## Application Won't Start

### Error: `Cannot find module 'X'`

**Problem:** Missing dependencies

**Solution:**
```powershell
# Reinstall all dependencies
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install
```

### Error: `Port 3000 is already in use`

**Problem:** Another application is using port 3000

**Solution 1 - Use different port:**
```bash
# Edit .env file
PORT=3001
```

**Solution 2 - Stop process using port 3000:**
```powershell
# Find process ID
netstat -ano | findstr :3000

# Kill the process (replace 1234 with actual PID)
Stop-Process -Id 1234 -Force
```

### Error: `TypeScript compilation failed`

**Problem:** TypeScript errors in source code

**Solution:**
```powershell
# Clean and rebuild
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
npm run build

# If errors persist, reinstall TypeScript
npm uninstall typescript
npm install typescript@latest
npm run build
```

### Error: `EACCES: permission denied`

**Problem:** No write permissions for database or logs

**Solution:**
```powershell
# Run PowerShell as Administrator, or
# Move database to user directory
DATABASE_PATH=C:/Users/YourName/Documents/vrcim.db
```

---

## VRChat Not Detected

### "VRChat is not running" message

**Check 1 - Is VRChat actually running?**
```powershell
Get-Process VRChat -ErrorAction SilentlyContinue
```

If not running:
- Launch VRChat
- Wait for it to fully start
- Refresh VRCIM dashboard

**Check 2 - Verify log path:**
```powershell
# Check default path exists
Test-Path "$env:USERPROFILE\AppData\LocalLow\VRChat\VRChat"
```

If path doesn't exist:
```bash
# Add custom path to .env
VRCHAT_LOG_PATH=C:/Your/Custom/Path/VRChat
```

**Check 3 - Restart VRCIM:**
```powershell
# Stop VRCIM (Ctrl+C)
# Start again
npm start
```

### VRChat running but no activity detected

**Problem:** Log file not being monitored

**Solution:**
1. Join a VRChat world (trigger log events)
2. Check VRCIM console for log parsing messages
3. Verify log file exists:
   ```powershell
   Get-ChildItem "$env:USERPROFILE\AppData\LocalLow\VRChat\VRChat\*.txt"
   ```
4. Check file permissions on log directory

---

## No Real-Time Updates

### Dashboard not updating automatically

**Check WebSocket connection:**
- Look for **"Connected"** (green) in top-right corner
- If **"Disconnected"** (red), see below

**Solution 1 - Check browser console:**
```
1. Press F12 to open DevTools
2. Click "Console" tab
3. Look for WebSocket errors
4. Look for "WebSocket connection failed"
```

**Solution 2 - Firewall/Antivirus:**
- Temporarily disable firewall/antivirus
- Test if updates work
- If yes, add exception for localhost:3000

**Solution 3 - Try different browser:**
- Chrome/Edge (recommended)
- Firefox
- Avoid Internet Explorer

**Solution 4 - Restart everything:**
```powershell
# Stop VRCIM
# Ctrl+C

# Kill any stuck Node processes
Stop-Process -Name node -Force

# Clear browser cache
# Ctrl+Shift+Delete in browser

# Start VRCIM
npm start

# Refresh browser (Ctrl+F5)
```

### WebSocket keeps disconnecting

**Problem:** Unstable WebSocket connection

**Check reconnection attempts:**
- Dashboard shows "Reconnecting... (attempt X/10)"
- After 10 attempts, shows "Retry Now" button

**Solutions:**
1. **Network issues:**
   - Check network stability
   - Restart router if on network connection
   - Try localhost only (HOST=localhost)

2. **Server overloaded:**
   - Close unnecessary applications
   - Check CPU/RAM usage
   - Restart VRCIM

3. **Browser issues:**
   - Clear browser cache
   - Disable browser extensions
   - Try incognito/private mode

---

## VRChat API Authentication Issues

### Login fails with "Invalid credentials"

**Solution:**
1. Verify username (not email) and password
2. Try logging in to [vrchat.com](https://vrchat.com) to verify credentials
3. Check for typos in username/password
4. Wait 5 minutes and try again (rate limiting)

### "Requires 2FA" error

**Problem:** 2FA enabled but code not entered

**Solution:**
1. Open your authenticator app (Google Authenticator, Authy, etc.)
2. Find VRChat entry
3. Enter the current 6-digit code
4. Click "Verify"

**If 2FA code invalid:**
- Ensure device time is synchronized
- Wait for code to refresh (codes change every 30 seconds)
- Try the next code if current one just expired

### "Token expired" or session lost

**Problem:** Authentication token no longer valid

**Solution:**
```powershell
# Simply re-login through the web interface
# Go to http://localhost:3000/login
```

**Auto-validation:**
- VRCIM automatically validates tokens every 30 minutes
- Tokens older than 2 hours are re-validated
- 3 consecutive failures = automatic logout

### Authentication stuck in a loop

**Problem:** Login redirects back to login page

**Solution:**
```powershell
# Clear authentication session
# Stop VRCIM
# Delete auth session from database
# Or delete entire database
Remove-Item vrcim.db
npm start
```

---

## Database Issues

### Error: `SQLITE_ERROR: no such column`

**Problem:** Database schema outdated (migration needed)

**Solution:**
```powershell
# VRCIM automatically runs migrations on startup
# If errors persist, recreate database:

# Stop VRCIM
# Backup old database
Copy-Item vrcim.db vrchat_monitor_backup.db

# Delete database
Remove-Item vrcim.db

# Restart VRCIM (creates fresh database)
npm start
```

### Error: `database is locked`

**Problem:** Another process accessing database

**Solution:**
```powershell
# Close all applications accessing the database
# Kill any stuck Node processes
Stop-Process -Name node -Force

# Remove lock files
Remove-Item vrcim.db-shm -ErrorAction SilentlyContinue
Remove-Item vrcim.db-wal -ErrorAction SilentlyContinue

# Start VRCIM
npm start
```

### Database growing too large

**Problem:** Database file size exceeds available disk space

**Current Size:**
```powershell
Get-Item vrcim.db | Select-Object Name, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}
```

**Solutions:**

**Option 1 - Archive and start fresh:**
```powershell
# Stop VRCIM
# Backup current database
Copy-Item vrcim.db "vrchat_monitor_archive_$(Get-Date -Format 'yyyy-MM-dd').db"

# Delete current database
Remove-Item vrcim.db

# Restart VRCIM
npm start
```

**Option 2 - Manual cleanup (advanced):**
1. Install [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Open `vrcim.db`
3. Execute SQL to delete old records:
   ```sql
   -- Delete logs older than 6 months
   DELETE FROM world_activity WHERE timestamp < date('now', '-6 months');
   DELETE FROM player_activity WHERE timestamp < date('now', '-6 months');
   
   -- Vacuum database to reclaim space
   VACUUM;
   ```

### Database corruption

**Symptoms:**
- `database disk image is malformed`
- Random errors when querying
- Application crashes on database access

**Solution:**
```powershell
# Try recovery with SQLite
sqlite3 vrcim.db ".recover" > recovered_data.sql

# If that fails, restore from backup or start fresh
Remove-Item vrcim.db
npm start
```

---

## Performance Issues

### Web UI slow with many users

**Problem:** Large dataset causing slow rendering

**Solutions:**
1. **Virtual scrolling activates automatically at 100+ users**
   - Ensure you're on latest version
   - Virtual scrolling renders only visible items

2. **Use filters:**
   - Filter by trust rank
   - Use search to find specific users

3. **Archive old data:**
   ```powershell
   # Backup and delete old database
   Copy-Item vrcim.db old_data.db
   Remove-Item vrcim.db
   npm start
   ```

### High CPU usage

**Problem:** VRCIM consuming too much CPU

**Causes:**
1. **Large VRChat log file (50MB+)**
   - VRCIM reads logs in 64KB chunks (optimized)
   - Very large files may still cause CPU spikes

2. **Many WebSocket clients**
   - Each browser tab is a WebSocket client
   - Close unnecessary tabs

**Solutions:**
```powershell
# Check log file size
Get-ChildItem "$env:USERPROFILE\AppData\LocalLow\VRChat\VRChat" | Sort-Object Length -Descending | Select-Object -First 1

# If > 50MB, consider deleting old VRChat logs
# VRChat will create new log files
```

### High memory usage

**Problem:** VRCIM using excessive RAM

**Normal Usage:**
- 200-500 MB RAM is normal
- 500MB-1GB with large database

**If > 1GB:**
```powershell
# Restart VRCIM
# Kill and restart
Stop-Process -Name node -Force
npm start
```

### WebSocket disconnecting frequently

**See "No Real-Time Updates" section above**

---

## VR Notification Issues

### Notifications not appearing

**Check 1 - Is overlay running?**
```powershell
# Check for OVR Toolkit
Get-Process | Where-Object {$_.ProcessName -like "*OVR*"}

# Check for XSOverlay
Get-Process XSOverlay -ErrorAction SilentlyContinue
```

**Check 2 - Enable in configuration:**
```bash
# Edit .env
OVRTOOLKIT_ENABLED=true
XSOVERLAY_ENABLED=true
```

**Check 3 - Check VRCIM console:**
```
# Look for messages like:
✓ Connected to OVR Toolkit
📱 Sent OVR Toolkit notification: Visitor joined: DisplayName
```

**Solution - Restart order:**
```
1. Stop VRCIM
2. Launch VR overlay (OVR Toolkit or XSOverlay)
3. Put on VR headset
4. Start VRCIM
5. Test by joining VRChat world with a Visitor
```

### Multiple notifications for same visitor

**Problem:** Both OVR Toolkit and XSOverlay enabled

**Solution:**
```bash
# Disable one in .env
OVRTOOLKIT_ENABLED=true
XSOVERLAY_ENABLED=false
```

### Notifications for non-visitors

**Problem:** Getting notifications for all users

**Cause:** This shouldn't happen - VRCIM only notifies for Visitors

**Solution:**
```
1. Check console logs for notification messages
2. Verify trust rank in user profile
3. Report bug on GitHub if confirmed
```

---

## Browser-Specific Issues

### Chrome/Edge

**Problem:** WebSocket connection fails

**Solution:**
- Disable "Predict network actions" in Settings
- Clear site data for localhost:3000
- Check for blocking extensions

### Firefox

**Problem:** WebSocket disconnects

**Solution:**
- Check `network.websocket.timeout.ping.request` in `about:config`
- Set to higher value (default 20)

### Safari (Mac - Experimental)

**Problem:** Not officially supported

**Solution:**
- Use Chrome or Firefox instead
- If testing Safari, check WebSocket compatibility

---

## Common Questions

### Q: Do I need to keep VRCIM running all the time?

**A:** No. Only run VRCIM when:
- VRChat is running
- You want to track activity
- Data persists in database between sessions

### Q: Can I access VRCIM from another computer?

**A:** Yes.
```bash
# Edit .env
HOST=0.0.0.0

# Access from other devices at:
http://YOUR_IP:3000
```

**Security Warning:** Only do this on trusted networks.

### Q: Will this get me banned from VRChat?

**A:** VRCIM uses the official VRChat API within rate limits (60 requests/min). However:
- Use at your own risk
- VRChat TOS applies
- No guarantees provided

### Q: Can I export my encounter data?

**A:** Currently no built-in export feature.

**Workaround:**
1. Install [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Open `vrcim.db`
3. File → Export → Table as CSV
4. Select table to export

### Q: Does VRCIM work on Linux/Mac?

**A:** Not officially tested. VRChat runs on Windows only.

**Possible to run VRCIM on Linux/Mac if:**
- You manually point to VRChat log files from Windows machine (network share)
- You copy log files to Linux/Mac machine
- No guarantees - Windows paths hardcoded in some places

### Q: How do I update VRCIM?

**Using Git:**
```powershell
git pull origin main
npm install
npm run build
npm start
```

**Manual:**
1. Download latest release
2. Copy `.env` and `vrcim.db` from old version
3. Extract new version
4. Paste `.env` and database
5. `npm install` and `npm run build`

### Q: Can I run multiple instances?

**A:** Yes, with different configurations:
```bash
# Instance 1
PORT=3000
DATABASE_PATH=./instance1.db

# Instance 2
PORT=3001
DATABASE_PATH=./instance2.db
```

---

## Still Having Issues?

### Before Opening an Issue

1. **Read this guide thoroughly** - Check all sections
2. **Search existing issues:** [GitHub Issues](https://github.com/SweetSamanthaVR/VRCIM/issues)
3. **Gather information:**
   - VRCIM version
   - Node.js version (`node --version`)
   - Windows version
   - Error messages (full text)
   - Console logs
   - Steps to reproduce

### Opening an Issue

Please include:
- **Title:** Brief description of the problem
- **Environment:**
  - OS: Windows 10/11
  - Node.js version
  - VRCIM version
- **Steps to reproduce:**
  1. What you did
  2. Step by step
  3. ...
- **Expected:** What should happen
- **Actual:** What actually happens
- **Screenshots:** If helpful
- **Console logs:** Copy/paste or screenshot
- **Errors:** Full error text

### Getting Help

- 📋 **GitHub Issues:** For bugs and features
- 📖 **Documentation:** Check all the docs
- 💬 **Discussions:** For questions and chat

---

## Additional Resources

- [Installation Guide](INSTALLATION.md)
- [Configuration Guide](CONFIGURATION.md)
- [Contributing Guide](CONTRIBUTING.md)
- [API Documentation](API.md)
- [Security Policy](SECURITY.md)

---

**Last Updated:** October 30, 2025

