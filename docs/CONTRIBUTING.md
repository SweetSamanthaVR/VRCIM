# Contributing to VRCIM

Thank you for considering contributing to VRCIM! This document provides guidelines for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Contributing Code](#contributing-code)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

**Be respectful and constructive:**
- Be kind and welcoming to other contributors
- Focus on the code and ideas, not the person
- Accept constructive feedback gracefully
- Help others learn and improve

**Not tolerated:**
- Harassment, insults, or personal attacks
- Spam or off-topic discussions
- Publishing others' private information

That's it. We're here to build cool VRChat tools together. 🎉

## How Can I Contribute?

### Reporting Bugs

Found a bug? Help us fix it!

**Before submitting:**
1. Check [existing issues](https://github.com/SweetSamanthaVR/VRCIM/issues) to avoid duplicates
2. Try the latest version to see if it's already fixed
3. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues

**Bug Report Template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - OS: [e.g. Windows 11]
 - Node.js version: [e.g. 20.10.0]
 - VRCIM version: [e.g. 1.0.0]
 - Browser: [e.g. Chrome 120]

**Console Logs**
```
Paste any error messages here
```

**Additional context**
Any other relevant information.
```

### Suggesting Features

Have an idea? We'd love to hear it!

**Feature Request Template:**
```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Any alternative solutions or features you've considered.

**Use cases**
How would you and others use this feature?

**Mockups/Examples**
If applicable, add mockups, diagrams, or examples.

**Additional context**
Any other information about the feature request.
```

### Contributing Code

Want to contribute code? Awesome!

1. **Small fixes** (typos, obvious bugs) - Just open a PR
2. **New features** - Open an issue first so we can discuss
3. **Big changes** - Definitely talk to me first!

## Development Setup

### Prerequisites

- Node.js 16.0.0 or higher
- Git
- Text editor (VS Code recommended)
- Windows 10/11 (for testing VRChat integration)

### Setup Steps

```powershell
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_FORK_USERNAME/VRCIM.git
cd VRCIM

# 3. Add upstream remote
git remote add upstream https://github.com/SweetSamanthaVR/VRCIM.git

# 4. Install dependencies
npm install

# 5. Create .env file (optional)
Copy-Item .env.example .env

# 6. Build the project
npm run build

# 7. Start development
npm run watch  # In one terminal
npm start      # In another terminal
```

### Development Workflow

```powershell
# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes in src/ directory
# TypeScript files auto-compile with watch mode

# Test your changes
npm run build  # Check for TypeScript errors
npm start      # Test the application

# Commit your changes
git add .
git commit -m "Add amazing feature"

# Push to your fork
git push origin feature/amazing-feature

# Open a Pull Request on GitHub
```

### Keeping Your Fork Updated

```powershell
# Fetch upstream changes
git fetch upstream

# Merge upstream main into your main
git checkout main
git merge upstream/main

# Push updates to your fork
git push origin main
```

## Code Style Guidelines

### TypeScript

**General Guidelines:**
- Use TypeScript strict mode
- Avoid `any` type where possible
- Define interfaces for complex objects
- Use meaningful variable names

**Example:**
```typescript
// ❌ Bad
function fn(x: any): any {
    return x.prop;
}

// ✅ Good
interface UserProfile {
    username: string;
    displayName: string;
}

function getUserProfile(userId: string): UserProfile | null {
    // Implementation
    return null;
}
```

### Naming Conventions

**TypeScript/JavaScript Code:** Use camelCase
```typescript
// Variables and function names
const userName = "Test";
const sessionUuid = "abc123";
function getUserData() {}
function getPlayerActivity() {}
```

**Database Columns:** Use snake_case (SQL convention)
```sql
-- Table columns
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    first_seen DATETIME,
    last_updated DATETIME
);
```

**Interfaces for Database Records:** Use snake_case to match database columns
```typescript
// Interface representing database row (uses snake_case)
interface AuthSession {
    id: number;
    is_authenticated: number;
    auth_cookie: string | null;
    user_id: string | null;
    last_validated: string | null;
}
```

**Application Logic:** Use camelCase, map from database when needed
```typescript
// When querying, use aliases to convert to camelCase
const stmt = db.prepare(`
    SELECT 
        user_id as userId,
        display_name as displayName,
        first_seen as firstSeen
    FROM users
`);

// Application interfaces use camelCase
interface UserProfile {
    userId: string;
    displayName: string;
    firstSeen: string;
}
```

**Classes:** PascalCase
  ```typescript
  class VRChatMonitor {}
  class DatabaseManager {}
  ```

**Constants:** SCREAMING_SNAKE_CASE
  ```typescript
  const MAX_RETRY_ATTEMPTS = 3;
  const DEFAULT_PORT = 8080;
  ```

**Private Members:** Prefix with `private`
  ```typescript
  class Example {
      private internalState: string;
  }
  ```

### Code Formatting

- **Indentation:** 4 spaces (no tabs)
- **Semicolons:** Required
- **Quotes:** Single quotes for strings
- **Line Length:** Aim for 120 characters max

**Example:**
```typescript
export class Example {
    private value: string;

    constructor(initialValue: string) {
        this.value = initialValue;
    }

    public getValue(): string {
        return this.value;
    }
}
```

### Comments

**JSDoc for public methods:**
```typescript
/**
 * Fetch user profile from VRChat API
 * @param userId - VRChat user ID (format: usr_xxx)
 * @returns User profile or null if not found
 */
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
    // Implementation
}
```

**Inline comments for complex logic:**
```typescript
// Calculate exponential backoff delay with jitter
const delay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
const jitter = Math.random() * 1000;
const totalDelay = delay + jitter;
```

### Error Handling

**Always wrap risky operations:**
```typescript
// ✅ Good
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    console.error('❌ Failed to perform operation:', error);
    throw error; // or handle gracefully
}
```

**Database operations:**
```typescript
try {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId);
} catch (error) {
    console.error('❌ Database error:', error);
    return null; // Safe fallback
}
```

## Testing

### Manual Testing

Before submitting a PR, test:

1. **Build succeeds:**
   ```powershell
   npm run build
   # Should complete with no errors
   ```

2. **Application starts:**
   ```powershell
   npm start
   # Should start without errors
   ```

3. **Core functionality:**
   - Dashboard loads
   - VRChat detection works
   - WebSocket connects
   - Database operations work
   - Authentication works (if modified)

4. **Your specific changes:**
   - Test the feature/fix you implemented
   - Test edge cases
   - Test error conditions

### Automated Testing

**Current Status:** No automated tests yet (help wanted!)

**Planned:**
- Unit tests with Jest
- Integration tests
- CI/CD with GitHub Actions

**If adding tests:**
```powershell
# Install Jest (when ready)
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Comments added for complex logic
- [ ] All TypeScript errors resolved (`npm run build`)
- [ ] Manually tested changes
- [ ] No merge conflicts with main branch
- [ ] Commit messages are clear

### PR Description Template

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran to verify your changes.

## Screenshots (if applicable)
Add screenshots to demonstrate changes.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new TypeScript errors
- [ ] I have tested this on a clean database
- [ ] I have tested this with VRChat running
```

### PR Review Process

1. **Automated Checks:** (when we add CI/CD)
   - Build succeeds
   - No TypeScript errors
   - Tests pass

2. **Code Review:**
   - Does it work?
   - Is it clean and maintainable?
   - Any security concerns?
   - Documentation updated?

3. **Discussion:**
   - I might suggest changes or improvements
   - Feel free to discuss or ask questions
   - Update your PR based on feedback

4. **Merge:**
   - Once approved, I'll merge it in
   - Usually squash and merge to keep history clean

## Areas Needing Help

### High Priority

- [ ] **Unit Tests** - Jest framework setup and tests
- [ ] **User Search** - Search functionality for users page
- [ ] **Data Export** - Export encounters as CSV/JSON
- [ ] **Database Backup** - Automatic backup system

### Medium Priority

- [ ] **Mobile UI** - Improve responsive design
- [ ] **Accessibility** - ARIA labels, keyboard navigation
- [ ] **Logging System** - Replace console.log with proper logging
- [ ] **Type Safety** - Replace `any` types with proper interfaces

### Low Priority

- [ ] **Dark/Light Theme Toggle** - User preference for themes
- [ ] **Trust Rank Colors** - Customizable colors for accessibility
- [ ] **Linux/Mac Support** - Test and fix compatibility
- [ ] **Desktop Notifications** - Browser notification support

## Documentation

### Documentation Needs Updates When:

- Adding new features
- Changing configuration options
- Adding new API endpoints
- Fixing bugs that users might encounter
- Changing installation/setup process

### Documentation Files

- `README.md` - Overview, quick start
- `docs/INSTALLATION.md` - Installation guide
- `docs/CONFIGURATION.md` - Configuration options
- `docs/TROUBLESHOOTING.md` - Common issues
- `docs/CONTRIBUTING.md` - This file
- `docs/SECURITY.md` - Security policy
- `docs/API.md` - API documentation

## Recognition

All contributors get:
- Credit in README.md
- Mentioned in release notes
- My sincere thanks! 🎉

**I value all types of contributions:**
- 💻 Code
- 📖 Documentation
- 🐛 Bug reports
- 💡 Feature ideas
- 🧪 Testing
- 🎨 Design
- 💬 Helping others

## Questions?

- **Got questions?** Open a discussion on GitHub
- **Found a bug?** Open an issue
- **Feature idea?** Open an issue
- **Security concern?** Check [SECURITY.md](SECURITY.md)

## Thank You!

Thanks for making VRCIM better! Whether it's code, bug reports, or just ideas - it all helps. 🙏

---

**Last Updated:** October 30, 2025
