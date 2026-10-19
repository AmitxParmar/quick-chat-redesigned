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
// server/src/utils/cookies.ts — CookieService.setTokenCookies()
res.cookie('access_token', accessToken, {
  httpOnly: true,   // not accessible to JavaScript
  secure: true,     // HTTPS only
  // The deployed frontend (vercel.app) and API (onrender.com) are different
  // sites, so browsers only attach the credentials to SameSite=None cookies.
  // Development stays same-site on localhost, where Lax is correct.
  sameSite: environment.isProd() ? 'none' : 'lax',
  maxAge: 15 * 60 * 1000,
  path: '/',
});
```

The same options are used for `refresh_token` (7-day `maxAge`) and for
`clearTokenCookies()`, so logout removes them with matching attributes.

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

- `SameSite=None; Secure` cookies (the SPA and API are on different sites in
  production). CSRF is blocked by the server-side origin allow-list, which
  rejects disallowed origins with `403` before any route runs.
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

The allow-list is `CLIENT_URL` plus the optional comma-separated
`ALLOWED_ORIGINS`. Entries are normalised (trimmed, trailing slashes removed,
lowercased) and `*` may be used inside an entry to cover per-deployment preview
URLs. A standalone `*` is ignored so a wildcard cannot silently allow every site
to send credentialed requests.

```typescript
// server/src/app.ts
this.express.use(cors({
  origin: (origin, callback) => {
    // No Origin header => not a browser cross-origin request (curl, probes,
    // server-to-server). CORS is browser-enforced, so let those through.
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin, environment.allowedOrigins)) {
      return callback(null, true);
    }
    // 403 (not 500) so a misconfigured allow-list is unmistakable.
    return callback(new HttpForbiddenError(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
```

`server/src/lib/cors-origins.ts` owns the matching logic and the Socket.IO
handshake uses the same list, so HTTP and WebSocket access can never drift.

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
