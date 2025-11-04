# VRCIM - VRChat Instance Monitor

A powerful real-time monitoring application for VRChat that tracks players, worlds, and visitor activity with VR notifications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Features

- 🔄 **Real-Time Monitoring** - Tracks VRChat process and log files live
- 👥 **Player Tracking** - Complete encounter history with timestamps
- 🌍 **World Activity** - Records all sessions with UUIDs
- 🔗 **VRChat API Integration** - Fetches live profiles (60 req/min)
- 🆕 **Visitor Detection** - Auto-refreshes Visitor profiles
- � **Nuisance Player Alerts** - VRChat-flagged troll detection
- �📱 **VR Notifications** - OVR Toolkit & XSOverlay support
- ⚡ **Live WebSocket Updates** - Real-time dashboard
- 🎨 **Modern Web UI** - Responsive dark theme
- 💾 **SQLite Database** - Persistent storage with transactions

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Start the application
npm start

# 4. Open in browser
# http://localhost:3000
```

**First-time setup**: Click "Login" and authenticate with your VRChat account.

## System Requirements

- **Node.js** 16.0.0 or higher
- **Windows** 10/11 (64-bit)
- **VRChat** installed and running
- **Memory** 2GB RAM minimum

## Documentation

- 📖 **[Installation Guide](docs/INSTALLATION.md)** - Detailed setup instructions
- ⚙️ **[Configuration](docs/CONFIGURATION.md)** - Environment variables and settings
- 🔧 **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- 🤝 **[Contributing](docs/CONTRIBUTING.md)** - How to contribute
- 🔌 **[API Documentation](docs/API.md)** - REST and WebSocket API reference
- 🔒 **[Security](docs/SECURITY.md)** - Security policy and best practices

## Trust Rank Colors

| Rank | Color | Description |
|------|-------|-------------|
| 🆕 Visitor | Gray | New accounts, always auto-refreshed |
| 🔵 New User | Blue | Recently verified accounts |
| 🟢 User | Green | Standard trusted users |
| 🟠 Known User | Orange | Established community members |
| 🟣 Trusted User | Purple | Highly trusted users |
| 🔴 Veteran User | Red | Long-time community members |

## VR Notifications

VRCIM sends 10-second notifications to your VR headset for important events:

- **🚨 Nuisance Players** - When a player with VRChat-applied nuisance tags joins (system_troll, system_probable_troll)
- **⚠️ Visitors** - When a Visitor rank player joins your instance

**Supported overlays:**
- **OVR Toolkit** (WebSocket) - Recommended
- **XSOverlay** (UDP)

Notifications are sent automatically when either overlay is running. Nuisance alerts take priority over visitor alerts.

## Project Structure

```
VRCIM/
├── src/              # TypeScript source code
├── dist/             # Compiled JavaScript (generated)
├── public/           # Static assets (CSS, JS, images)
├── views/            # EJS templates
├── docs/             # Documentation files
├── CHANGELOG.md      # Version history
├── LICENSE           # MIT License
└── README.md         # This file
```

## Common Commands

```bash
# Development
npm run build         # Compile TypeScript
npm start            # Start application
npm run dev          # Build and start
npm run watch        # Watch mode (auto-rebuild)

# Configuration
cp .env.example .env # Create config file
```

## Technology Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: SQLite (better-sqlite3)
- **WebSocket**: ws library
- **Templates**: EJS
- **API Client**: axios
- **VR Integration**: OVR Toolkit, XSOverlay

## Quick Links

- **Dashboard**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **Users**: http://localhost:3000/users

## Screenshots

### Dashboard - Real-Time Monitoring
*Real-time feed of world joins/leaves and player activity*

### Users List - Profile Browser
*Browse all encountered users with trust ranks and stats*

### User Details - Encounter History
*Detailed encounter timeline for each user*

## Support

- 📋 **Issues**: [GitHub Issues](https://github.com/SweetSamanthaVR/VRCIM/issues)
- 💬 **Questions**: Check [Troubleshooting](docs/TROUBLESHOOTING.md) first
- 🐛 **Found a bug?** Open an issue
- 💡 **Feature idea?** Open a feature request

## Contributing

Want to help? Awesome! Check out [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

**Quick steps:**
1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## Disclaimer

⚠️ **Important**: This tool is **NOT affiliated with VRChat Inc.** Use at your own risk. Respect VRChat's Terms of Service.

---

**Version:** 1.3.0  
**Last Updated:** November 3, 2025
