# Security

> Authentication, validation, and attack prevention.

[← Performance](PERFORMANCE.md) · [Client README →](../client/README.md)

## Authentication Security

### JWT Implementation

- **Access tokens**: 15-minute expiry, signed with HS256
- **Refresh tokens**: 7-day expiry, stored in Redis
- **Token rotation**: New refresh token on every refresh
- **Single-device enforcement**: Only one active session per device

### Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Minimum 8 characters, enforced at API level
- **No plaintext storage**: Passwords never logged or returned in responses

### Cookie Security

```typescript
// server/src/modules/auth/auth.service.ts
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,      // Not accessible via JavaScript
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

## Input Validation

### Zod Schemas

All inputs validated with Zod schemas before processing:

```typescript
// Example: Message creation
const createMessageSchema = z.object({
  to: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
});
```

### Validation Layers

1. **Client-side**: Form validation before submission
2. **API middleware**: Zod validation on every request
3. **Service layer**: Business logic validation
4. **Database**: Prisma schema constraints

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 requests | 1 minute |
| Register | 3 requests | 5 minutes |
| Message send | 30 requests | 1 minute |
| Token refresh | 10 requests | 1 minute |

**Implementation:** Sliding window counter in Redis with IP-based fallback.

## Attack Prevention

### SQL/NoSQL Injection

Prisma ORM parameterizes all queries automatically. Raw queries are avoided.

### XSS (Cross-Site Scripting)

- React escapes content by default
- No `dangerouslySetInnerHTML` usage
- Content Security Policy headers via Helmet

### CSRF (Cross-Site Request Forgery)

- SameSite=Strict cookies
- CORS restricted to known origins
- Socket.io origin validation

### Token Theft

- Refresh token rotation limits theft window
- Single-device enforcement invalidates old tokens
- Short access token expiry (15 minutes)

### Denial of Service

- Rate limiting per IP and endpoint
- Request body size limits (10KB)
- Socket.io connection limits

## Infrastructure Security

### Helmet Headers

```typescript
// server/src/lib/app.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
```

### CORS Configuration

```typescript
// server/src/lib/app.ts
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### Trust Proxy

```typescript
// server/src/lib/app.ts
app.set('trust proxy', 1); // Trust first proxy
```

## Data Protection

### Sensitive Data

- Passwords never returned in API responses
- Refresh tokens stored in HttpOnly cookies
- No sensitive data in logs

### User Privacy

- Phone numbers used for identification only
- No tracking or analytics without consent
- User can delete account and data

## Security Checklist

- [x] JWT with short expiry and refresh rotation
- [x] bcrypt password hashing
- [x] Input validation on all endpoints
- [x] Rate limiting on sensitive endpoints
- [x] CORS restricted to known origins
- [x] Helmet security headers
- [x] HttpOnly secure cookies
- [x] No sensitive data in logs
- [x] Socket.io origin validation

## Related Documentation

- [System Design](SYSTEM_DESIGN.md) — Auth flow
- [Deployment](DEPLOYMENT.md) — Production security
- [Server README](../server/README.md) — Middleware details
