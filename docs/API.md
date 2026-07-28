# API Reference

> REST endpoints and WebSocket events.

[← Engineering Decisions](ENGINEERING_DECISIONS.md) · [Deployment →](DEPLOYMENT.md)

## REST API

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Create account | No |
| `POST` | `/api/auth/login` | Sign in | No |
| `POST` | `/api/auth/refresh` | Refresh access token | Cookie |
| `POST` | `/api/auth/logout` | Sign out | Yes |
| `GET` | `/api/auth/me` | Current user | Yes |

### Messages

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/messages` | Send message | Yes |
| `GET` | `/api/messages/:id` | Get message by ID | Yes |
| `GET` | `/api/messages/conversations/:id` | Get conversation messages | Yes |

### Conversations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/conversations` | Create conversation | Yes |
| `GET` | `/api/conversations` | List user conversations | Yes |
| `GET` | `/api/conversations/:id` | Get conversation | Yes |
| `PUT` | `/api/conversations/:id` | Update conversation | Yes |
| `DELETE` | `/api/conversations/:id` | Delete conversation | Yes |
| `POST` | `/api/conversations/:id/read` | Mark as read | Yes |
| `PUT` | `/api/conversations/:id/name` | Update group name | Yes |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/users` | List users | Yes |
| `GET` | `/api/users/me` | Get profile | Yes |
| `PUT` | `/api/users/me` | Update profile | Yes |
| `POST` | `/api/users/me/subscription` | Save push subscription | Yes |

### Contacts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/contacts` | Add contact | Yes |
| `GET` | `/api/contacts` | List contacts | Yes |
| `GET` | `/api/contacts/:id` | Get contact | Yes |
| `PUT` | `/api/contacts/:id` | Update contact | Yes |
| `DELETE` | `/api/contacts/:id` | Remove contact | Yes |

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{conversationId, content, tempId?}` | Send message |
| `message:read` | `{conversationId}` | Mark conversation as read |
| `message:delivered` | `{messageId}` | Confirm delivery |
| `user:typing` | `{conversationId}` | Typing indicator |
| `user:stopTyping` | `{conversationId}` | Stop typing |
| `user:online` | `{}` | Heartbeat |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message:receive` | `Message` object | New message received |
| `message:send:ack` | `{tempId, message}` | Send confirmation |
| `message:status` | `{messageId, status}` | Status update |
| `message:delivered` | `{messageId}` | Delivery confirmation |
| `message:read` | `{conversationId, messageIds}` | Read receipt |
| `conversation:create` | `Conversation` | New conversation created |
| `user:online` | `{userId}` | User came online |
| `user:offline` | `{userId}` | User went offline |
| `user:typing` | `{conversationId, userId}` | User is typing |
| `user:stopTyping` | `{conversationId, userId}` | User stopped typing |

## Request/Response Examples

### Send Message

**Request:**
```http
POST /api/messages
Content-Type: application/json
Authorization: Bearer <accessToken>

{
  "to": "user_abc123",
  "content": "Hello, World!"
}
```

**Response:**
```json
{
  "id": "msg_xyz789",
  "from": "user_def456",
  "to": "user_abc123",
  "content": "Hello, World!",
  "status": "sent",
  "conversationId": "conv_abc123",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Create Conversation

**Request:**
```http
POST /api/conversations
Content-Type: application/json
Authorization: Bearer <accessToken>

{
  "participantId": "user_abc123"
}
```

**Response:**
```json
{
  "id": "conv_xyz789",
  "participants": ["user_def456", "user_abc123"],
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Refresh Token

**Request:**
```http
POST /api/auth/refresh
Cookie: refreshToken=<token>
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_def456",
    "phone": "1234567890",
    "name": "Alice"
  }
}
```

## Error Responses

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "content",
        "message": "Content must be between 1 and 5000 characters"
      }
    ]
  }
}
```

## Rate Limiting

When rate limited:
```json
{
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 60
  }
}
```

## Related Documentation

- [Message Flow](MESSAGE_FLOW.md) — Delivery sequence diagrams
- [Security](SECURITY.md) — Auth and validation details
- [Server README](../server/README.md) — Route implementation
