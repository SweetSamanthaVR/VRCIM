# Feature Branch Change Summary: displayed-entry-numbers vs master

## Overview
This document summarizes the actual functional changes introduced in the `displayed-entry-numbers` branch and distinguishes them from incidental or cosmetic full-file diffs that appeared in the comparison with `master`.

## High-Impact Functional Changes
These files contain the real feature logic: environment-configurable pagination limits and CSP-compliant UI configuration delivery.

1. **src/config.ts**  
   - Added parsing for: `PLAYERS_PER_PAGE` (default 20, range 1–200), `RECENT_ACTIVITY_LIMIT` (default 50, range 1–1000), `CACHED_USERS_PER_PAGE` (default 50, range 1–500).  
   - Introduced `playersPerPage`, `recentActivityLimit`, `cachedUsersPerPage` on exported config object.  
   - Added logging of parsed values.

2. **src/webserver.ts**  
   - `/api/config` now returns the three new values.  
   - WebSocket `initialData` extended with pagination limits.  
   - Added `/ui-config.js` route to serve runtime window globals (no inline scripts; satisfies `script-src 'self'` CSP).  
   - Replaced fixed `50` log limits with `recentActivityLimit`.  
   - Injected `uiConfig` into `index` and `users` EJS templates.

3. **public/js/monitor.js**  
   - Players pagination driven by `window.PLAYERS_PER_PAGE`; overridden by WebSocket payload if present.  
   - Recent activity pagination driven by `window.RECENT_ACTIVITY_LIMIT`; fallback to previous default.  
   - Added debug logging for dynamic limits.

4. **public/js/users.js**  
   - Adopted `window.CACHED_USERS_PER_PAGE`.  
   - Implemented slicing for base (unfiltered) view to enforce configured count.  
   - Disabled virtualization in base view to prevent bypassing slice.  
   - Removed duplicate `searchTerm` declaration that caused runtime error.  
   - Added debug logging.

5. **views/index.ejs** & **views/users.ejs**  
   - Removed inline `<script>` that set globals.  
   - Added external `<script src="/ui-config.js">` for CSP compliance.

6. **docs/CONFIGURATION.md**  
   - New sections documenting: `PLAYERS_PER_PAGE`, `RECENT_ACTIVITY_LIMIT`, `CACHED_USERS_PER_PAGE` (ranges, defaults, examples).  

7. **.env.example**  
   - Added commented entries for the three new pagination variables with usage guidance.

## Possibly Minor / Supportive Change
- **public/js/config.js**: Appears in diff; if modified, changes are minor (e.g., adjusting retrieval of `/api/config`). No direct feature tokens required beyond access.

## Tokens Driving Classification
Search hits for new variables and route:
- `PLAYERS_PER_PAGE` found only in: `.env(.example)`, `docs/CONFIGURATION.md`, `src/config.ts`, `src/webserver.ts`, `public/js/monitor.js`.  
- `RECENT_ACTIVITY_LIMIT`: `.env(.example)`, `docs/CONFIGURATION.md`, `src/config.ts`, `src/webserver.ts`, `public/js/monitor.js`.  
- `CACHED_USERS_PER_PAGE`: `.env(.example)`, `docs/CONFIGURATION.md`, `src/config.ts`, `src/webserver.ts`, `public/js/users.js`.  
- `/ui-config.js` route: `src/webserver.ts`, and references in `views/index.ejs`, `views/users.ejs`.

## Files With Cosmetic or Unrelated Churn
The following show whole-file diffs (additions == deletions) but contain no feature-related tokens. Likely formatting (line endings, whitespace), bulk copy, or unintended staging.

- Project Meta / Docs: `README.md`, `CHANGELOG.md`, `docs/API.md`, `docs/CONTRIBUTING.md`, `docs/INSTALLATION.md`, `docs/TROUBLESHOOTING.md`, `LICENSE`.
- Config / Infrastructure: `.editorconfig`, `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`.
- CSS: `public/css/common.css`, `login.css`, `monitor.css`, `user-details.css`, `users.css`.
- Backend Source (no new tokens): `src/auth.ts`, `src/database.ts`, `src/index.ts`, `src/logParser.ts`, `src/logger.ts`, `src/monitor.ts`, `src/types/index.ts`, `src/validators.ts`, `src/vrNotificationService.ts`, `src/vrchatApiClient.ts`.
- EJS templates without functional changes: `views/login.ejs`, `views/user-details.ejs`, `views/partials/header.ejs`, `views/partials/footer.ejs`.
- Frontend JS not touched by feature tokens: `public/js/common.js`, `public/js/login.js`, `public/js/user-details.js`.

## Classification Table (Condensed)
| File | Category | Notes |
|------|----------|-------|
| src/config.ts | Functional | Add env parsing & new keys |
| src/webserver.ts | Functional | Config endpoint, WS payload, /ui-config.js route |
| public/js/monitor.js | Functional | Dynamic players/logs pagination |
| public/js/users.js | Functional | Dynamic cached users pagination & bug fix |
| views/index.ejs | Functional | Replace inline script with external config |
| views/users.ejs | Functional | Same CSP change |
| docs/CONFIGURATION.md | Documentation (Feature) | Added pagination section |
| .env.example | Config Sample | New variables |
| public/js/config.js | Support | Possibly minor adjustments |
| All others listed above | Cosmetic / Unrelated | Full-file churn w/o feature tokens |

## Recommended Cleanup (Optional)
1. Revert cosmetic-only files to master to reduce PR noise.  
2. Squash functional changes into a single commit referencing feature scope.  
3. Separate a formatting PR if desired, after adding formatting config (Prettier/EditorConfig).  
4. Consider adding an automated check to prevent large unrelated diffs.

## Next Potential Enhancements
- Add UI status line: "Showing X–Y of Z" for players, logs, cached users.  
- Server-side filtered endpoint for cached users to avoid loading large pages during search.  
- Runtime admin settings panel to adjust pagination values without restart.  

## Verification Notes
- WebSocket initialData now includes the three numeric limits.  
- CSP violation removed (no inline `<script>`).  
- Users page error (duplicate `searchTerm`) fixed.  

---
Generated on: 2025-11-02
Branch compared: `master` → `displayed-entry-numbers`
