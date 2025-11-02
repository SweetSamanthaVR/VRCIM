# VRCIM API Documentation

**Version:** 1.0.0  
**Last Updated:** October 30, 2025

This document describes the REST API endpoints and WebSocket messages for the VRChat Instance Monitor (VRCIM) application.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
  - [Logs & Activity](#logs--activity)
  - [User Management](#user-management)
  - [Authentication](#authentication-endpoints)
  - [Configuration](#configuration)
- [WebSocket API](#websocket-api)
  - [Connection](#connection)
  - [Message Types](#message-types)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Base URL

**Development:** `http://localhost:3000`  
**Production:** Configure via `PORT` and `HOST` environment variables

All API endpoints are prefixed with `/api` unless otherwise noted.

---

## Authentication

VRCIM uses session-based authentication with VRChat API credentials. Authentication is required for:
- User profile refresh (`POST /api/users/:userId/refresh`)
- VRChat API integration features

All other endpoints are publicly accessible for monitoring purposes.

---

## REST API Endpoints

### Logs & Activity

#### **GET /api/logs**

Get combined activity logs from world and player events.

**Query Parameters:**
- `limit` (optional): Number of logs to return (1-1000, default: 100)

**Response:**
```json
{
  "logs": [
    {
      "id": 123,
      "timestamp": "2025-10-30T12:34:56.789Z",
      "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "Joining World",
      "world_name": "Example World",
      "world_id": "wrld_12345678-1234-1234-1234-123456789abc",
      "table": "world_activity"
    },
    {
      "id": 124,
      "timestamp": "2025-10-30T12:35:12.456Z",
      "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "Player Join",
      "player_id": "usr_12345678-1234-1234-1234-123456789abc",
      "player_name": "ExampleUser",
      "table": "player_activity"
    }
  ],
  "stats": {
    "totalSessions": 150,
    "totalEncounters": 2500,
    "uniquePlayers": 350
  }
}
```

**Example:**
```bash
GET /api/logs?limit=50
```

---

#### **GET /api/player/:playerId**

Get activity history for a specific player.

**URL Parameters:**
- `playerId` (required): VRChat User ID (format: `usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Response:**
```json
{
  "history": [
    {
      "id": 456,
      "timestamp": "2025-10-30T12:35:12.456Z",
      "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "Player Join",
      "player_id": "usr_12345678-1234-1234-1234-123456789abc",
      "player_name": "ExampleUser"
    }
  ]
}
```

**Example:**
```bash
GET /api/player/usr_12345678-1234-1234-1234-123456789abc
```

**Errors:**
- `400` - Invalid player ID format
- `500` - Database error

---

#### **GET /api/session/:sessionUuid**

Get all player activity for a specific session.

**URL Parameters:**
- `sessionUuid` (required): Session UUID (format: standard UUID v4)

**Response:**
```json
{
  "players": [
    {
      "id": 789,
      "timestamp": "2025-10-30T12:35:12.456Z",
      "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "Player Join",
      "player_id": "usr_12345678-1234-1234-1234-123456789abc",
      "player_name": "ExampleUser"
    }
  ]
}
```

**Example:**
```bash
GET /api/session/550e8400-e29b-41d4-a716-446655440000
```

**Errors:**
- `400` - Invalid session UUID format
- `500` - Database error

---

### User Management

#### **GET /api/users/cached**

Get cached VRChat user profiles with pagination.

**Query Parameters:**
- `limit` (optional): Number of users to return (1-1000, default: 100)
- `offset` (optional): Number of users to skip (>=0, default: 0)

**Response:**
```json
{
  "users": [
    {
      "id": "usr_12345678-1234-1234-1234-123456789abc",
      "username": "exampleuser",
      "displayName": "Example User",
      "bio": "Hello VRChat!",
      "bioLinks": ["https://example.com"],
      "profilePicOverride": "https://api.vrchat.cloud/api/1/file/...",
      "status": "active",
      "statusDescription": "Exploring worlds",
      "currentAvatarImageUrl": "https://api.vrchat.cloud/api/1/image/...",
      "currentAvatarThumbnailImageUrl": "https://api.vrchat.cloud/api/1/image/...",
      "userIcon": "https://api.vrchat.cloud/api/1/image/...",
      "trustRank": "Trusted User",
      "tags": ["system_trust_trusted"],
      "lastUpdated": "2025-10-30T12:00:00.000Z",
      "timesEncountered": 15
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 350,
    "hasMore": true
  }
}
```

**Example:**
```bash
GET /api/users/cached?limit=50&offset=100
```

---

#### **GET /api/users/:userId**

Get cached profile and encounter history for a specific user.

**URL Parameters:**
- `userId` (required): VRChat User ID

**Response:**
```json
{
  "user": {
    "id": "usr_12345678-1234-1234-1234-123456789abc",
    "username": "exampleuser",
    "displayName": "Example User",
    "trustRank": "Trusted User",
    "lastUpdated": "2025-10-30T12:00:00.000Z"
  },
  "encounters": [
    {
      "id": 123,
      "userId": "usr_12345678-1234-1234-1234-123456789abc",
      "sessionUuid": "550e8400-e29b-41d4-a716-446655440000",
      "worldName": "Example World",
      "worldId": "wrld_12345678-1234-1234-1234-123456789abc",
      "timestamp": "2025-10-30T12:35:12.456Z",
      "displayName": "Example User"
    }
  ],
  "encounterCount": 15
}
```

**Example:**
```bash
GET /api/users/usr_12345678-1234-1234-1234-123456789abc
```

**Errors:**
- `400` - Invalid user ID format
- `404` - User not found in cache
- `500` - Database error

---

#### **GET /api/users/:userId/live**

Get live profile data from VRChat API (requires authentication).

**URL Parameters:**
- `userId` (required): VRChat User ID

**Response:**
```json
{
  "user": {
    "id": "usr_12345678-1234-1234-1234-123456789abc",
    "username": "exampleuser",
    "displayName": "Example User",
    "bio": "Hello VRChat!",
    "trustRank": "Trusted User",
    "status": "active",
    "statusDescription": "Exploring worlds",
    "location": "wrld_12345678-1234-1234-1234-123456789abc:instance_id",
    "friendKey": "friend_key_here"
  },
  "isFriend": false
}
```

**Example:**
```bash
GET /api/users/usr_12345678-1234-1234-1234-123456789abc/live
```

**Errors:**
- `400` - Invalid user ID format
- `401` - Not authenticated
- `403` - VRChat API access denied
- `404` - User not found
- `500` - API error

---

#### **POST /api/users/:userId/refresh**

Refresh cached user profile from VRChat API (requires authentication).

**URL Parameters:**
- `userId` (required): VRChat User ID

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "usr_12345678-1234-1234-1234-123456789abc",
    "username": "exampleuser",
    "displayName": "Example User",
    "trustRank": "Trusted User",
    "lastUpdated": "2025-10-30T13:00:00.000Z"
  }
}
```

**Example:**
```bash
POST /api/users/usr_12345678-1234-1234-1234-123456789abc/refresh
```

**Errors:**
- `400` - Invalid user ID format
- `401` - Not authenticated
- `403` - VRChat API access denied
- `404` - User not found
- `500` - API error

---

### Authentication Endpoints

#### **POST /api/auth/login**

Authenticate with VRChat API.

**Request Body:**
```json
{
  "username": "your_vrchat_username",
  "password": "your_vrchat_password"
}
```

**Response (Success - No 2FA):**
```json
{
  "success": true,
  "requires2FA": false
}
```

**Response (2FA Required):**
```json
{
  "success": false,
  "requires2FA": true
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

**Example:**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "myusername",
  "password": "mypassword"
}
```

**Errors:**
- `400` - Invalid credentials format
- `401` - Invalid username or password
- `500` - Authentication error

---

#### **POST /api/auth/verify-2fa**

Verify two-factor authentication code.

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true
}
```

**Example:**
```bash
POST /api/auth/verify-2fa
Content-Type: application/json

{
  "code": "123456"
}
```

**Errors:**
- `400` - Invalid code format
- `401` - Invalid or expired code
- `500` - Verification error

---

#### **GET /api/auth/status**

Get current authentication status.

**Response:**
```json
{
  "isAuthenticated": true,
  "username": "myusername",
  "userId": "usr_12345678-1234-1234-1234-123456789abc"
}
```

**Example:**
```bash
GET /api/auth/status
```

---

#### **POST /api/auth/logout**

Clear authentication session.

**Response:**
```json
{
  "success": true
}
```

**Example:**
```bash
POST /api/auth/logout
```

---

### Configuration

#### **GET /api/config**

Get frontend configuration settings.

**Response:**
```json
{
  "wsUrl": "ws://localhost:3000",
  "serverUrl": "http://localhost:3000"
}
```

**Example:**
```bash
GET /api/config
```

---

## WebSocket API

### Connection

Connect to the WebSocket server for real-time updates:

**URL:** `ws://localhost:3000` (or configured host/port)

**Example (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('Connected to VRCIM');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};
```

---

### Message Types

#### **Server → Client: initialData**

Sent immediately upon connection with current state.

**Message:**
```json
{
  "type": "initialData",
  "logs": [
    {
      "id": 123,
      "timestamp": "2025-10-30T12:34:56.789Z",
      "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "Joining World",
      "world_name": "Example World",
      "table": "world_activity"
    }
  ],
  "stats": {
    "totalSessions": 150,
    "totalEncounters": 2500,
    "uniquePlayers": 350
  },
  "currentSession": "550e8400-e29b-41d4-a716-446655440000",
  "currentWorld": "Example World",
  "currentWorldTimestamp": "2025-10-30T12:34:56.789Z",
  "playerCount": 5
}
```

---

#### **Server → Client: log**

Broadcast when a new activity log entry is created.

**Message:**
```json
{
  "type": "log",
  "log": {
    "id": 124,
    "timestamp": "2025-10-30T12:35:12.456Z",
    "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "Player Join",
    "player_id": "usr_12345678-1234-1234-1234-123456789abc",
    "player_name": "ExampleUser",
    "table": "player_activity"
  }
}
```

---

#### **Server → Client: session**

Broadcast when a new VRChat session starts (world join).

**Message:**
```json
{
  "type": "session",
  "sessionUUID": "550e8400-e29b-41d4-a716-446655440000",
  "worldName": "Example World",
  "timestamp": "2025-10-30T12:34:56.789Z"
}
```

---

#### **Server → Client: playerCount**

Broadcast when the player count in the current world changes.

**Message:**
```json
{
  "type": "playerCount",
  "count": 5
}
```

---

#### **Server → Client: vrchatStatus**

Broadcast when VRChat process status changes.

**Message:**
```json
{
  "type": "vrchatStatus",
  "isRunning": true
}
```

---

## Data Models

### World Activity Log

```typescript
{
  id: number;
  timestamp: string;           // ISO 8601 format
  session_uuid: string;         // UUID v4 format
  event_type: string;           // "Joining World" | "Left World"
  world_name: string;
  world_id: string;             // Format: wrld_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  table: "world_activity";
}
```

### Player Activity Log

```typescript
{
  id: number;
  timestamp: string;           // ISO 8601 format
  session_uuid: string;         // UUID v4 format
  event_type: string;           // "Player Join" | "Player Leave"
  player_id: string;            // Format: usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  player_name: string;
  table: "player_activity";
}
```

### Cached User Profile

```typescript
{
  id: string;                   // VRChat User ID
  username: string;
  displayName: string;
  bio: string | null;
  bioLinks: string[] | null;    // JSON array
  profilePicOverride: string | null;
  status: string;
  statusDescription: string;
  currentAvatarImageUrl: string | null;
  currentAvatarThumbnailImageUrl: string | null;
  userIcon: string | null;
  trustRank: string;            // "Visitor" | "New User" | "User" | "Known User" | "Trusted User" | "Veteran User"
  tags: string[] | null;        // JSON array
  lastUpdated: string;          // ISO 8601 format
  timesEncountered: number;     // Populated in some responses
}
```

### User Encounter

```typescript
{
  id: number;
  userId: string;               // VRChat User ID
  sessionUuid: string;          // UUID v4
  worldName: string;
  worldId: string;
  timestamp: string;            // ISO 8601 format
  displayName: string;
}
```

### Statistics

```typescript
{
  totalSessions: number;        // Total world sessions recorded
  totalEncounters: number;      // Total player encounters
  uniquePlayers: number;        // Unique players encountered
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "details": "Optional additional details"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server-side error)

### Common Errors

**Invalid User ID Format:**
```json
{
  "error": "Invalid User ID format",
  "details": "User ID must match format: usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Invalid Session UUID:**
```json
{
  "error": "Invalid Session UUID format",
  "details": "Session UUID must be a valid UUID v4 format"
}
```

**Authentication Required:**
```json
{
  "error": "Authentication required",
  "details": "Please log in via /login"
}
```

---

## Rate Limiting

VRCIM currently does not implement rate limiting on the API endpoints. However, the VRChat API client implements a queue system with:

- **Rate Limit:** 60 requests per minute
- **Queue Processing:** Automatic with 1-second intervals
- **Retry Logic:** Automatic retry with exponential backoff

When using the `/api/users/:userId/refresh` endpoint, requests are automatically queued if the rate limit is reached.

---

## Security Considerations

### Input Validation

All API endpoints implement strict input validation:
- VRChat User IDs must match: `usr_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`
- Session UUIDs must be valid UUID v4 format
- Pagination parameters are sanitized and bounded
- Login credentials are validated for length and suspicious patterns

### Content Security Policy

The API implements comprehensive CSP headers to prevent XSS attacks:
- Scripts only from same origin
- Styles from same origin + inline styles
- Images from same origin, data URIs, and HTTPS
- WebSocket connections to localhost only
- No iframe embedding allowed

### Authentication

- Session-based authentication with secure cookie storage
- Automatic token validation (every 30 minutes)
- Token staleness detection (2-hour threshold)
- Automatic logout after 3 failed validations
- 2FA support for VRChat accounts

---

## Example Usage

### JavaScript/Node.js

```javascript
// Fetch cached users with pagination
async function getUsers(limit = 100, offset = 0) {
  const response = await fetch(
    `http://localhost:3000/api/users/cached?limit=${limit}&offset=${offset}`
  );
  const data = await response.json();
  return data;
}

// Get user profile and encounters
async function getUserProfile(userId) {
  const response = await fetch(
    `http://localhost:3000/api/users/${userId}`
  );
  const data = await response.json();
  return data;
}

// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'initialData':
      console.log('Initial data:', message);
      break;
    case 'log':
      console.log('New log entry:', message.log);
      break;
    case 'session':
      console.log('New session:', message.sessionUUID);
      break;
    case 'playerCount':
      console.log('Player count:', message.count);
      break;
    case 'vrchatStatus':
      console.log('VRChat running:', message.isRunning);
      break;
  }
};
```

### Python

```python
import requests
import json
from websocket import create_connection

# Fetch cached users
def get_users(limit=100, offset=0):
    response = requests.get(
        f'http://localhost:3000/api/users/cached',
        params={'limit': limit, 'offset': offset}
    )
    return response.json()

# Get user profile
def get_user_profile(user_id):
    response = requests.get(
        f'http://localhost:3000/api/users/{user_id}'
    )
    return response.json()

# Connect to WebSocket
ws = create_connection('ws://localhost:3000')
message = json.loads(ws.recv())
print(f'Received: {message}')
```

### cURL

```bash
# Get activity logs
curl http://localhost:3000/api/logs?limit=50

# Get cached users
curl http://localhost:3000/api/users/cached?limit=100&offset=0

# Get user profile
curl http://localhost:3000/api/users/usr_12345678-1234-1234-1234-123456789abc

# Login to VRChat
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"myusername","password":"mypassword"}'

# Refresh user profile (requires authentication)
curl -X POST http://localhost:3000/api/users/usr_12345678-1234-1234-1234-123456789abc/refresh
```

---

## Changelog

### Version 1.0.0 (October 30, 2025)
- Initial API documentation
- REST API endpoints for logs, users, and authentication
- WebSocket API for real-time updates
- Comprehensive data models and error handling
- Example usage in multiple languages

---

## Support

For issues, questions, or contributions, please visit the GitHub repository or contact the project maintainers.

**License:** MIT License  
**Project:** VRCIM - VRChat Instance Monitor
