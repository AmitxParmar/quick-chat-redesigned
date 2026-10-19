# Deployment

> Environment setup, Docker, and production build.

[← API Reference](API.md) · [Performance →](PERFORMANCE.md)

## Prerequisites

- Node.js 22
- pnpm
- MongoDB (local or Atlas)
- Redis (local or Upstash)

## Environment Variables

### Server

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 8000) |
| `NODE_ENV` | Yes | `development`, `production`, or `test` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `JWT_ACCESS_EXPIRY` | Yes | Access token lifetime (e.g., `15m`) |
| `JWT_REFRESH_EXPIRY` | Yes | Refresh token lifetime (e.g., `7d`) |
| `CLIENT_URL` | Yes | Primary frontend origin allowed to call the API (trailing slashes are stripped) |
| `SWAGGER_ENABLED` | No | Enable Swagger UI (default: `false`) |
| `ALLOWED_ORIGINS` | No | Extra origins, comma-separated. `*` is allowed inside an entry for previews, e.g. `https://my-app-*.vercel.app` |

### Client

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | No | Backend API URL incl. env segment (default: `http://localhost:8000/api/v1/development`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Web Push public key |
| `NEXT_PUBLIC_VITALS_ENDPOINT` | No | Optional Web Vitals reporting endpoint |

### Allowed Origins (CORS)

The API answers browser requests only when the `Origin` header matches
`CLIENT_URL` or one of the `ALLOWED_ORIGINS`. A mismatch returns
`403 Origin not allowed: …`; requests with no `Origin` header (curl, health
checks, server-to-server) pass through, because CORS is browser-enforced.
Socket.IO handshakes use the same list, so HTTP and WebSocket access never
drift apart.

Vercel serves one deployment under several URLs (primary domain, per-deployment
URL, branch aliases), so add a scoped wildcard to keep previews working:

```bash
CLIENT_URL=https://my-app.vercel.app
ALLOWED_ORIGINS=https://my-app-*.vercel.app,https://my-app-git-main-me.vercel.app
```

A standalone `*` is ignored on purpose — with `credentials: true` it would let
any site send credentialed requests.

### Cross-site cookies and the session hint

When the frontend and API live on different sites (for example `*.vercel.app`
and `*.onrender.com`), the browser stores the API's `access_token` /
`refresh_token` cookies against the **API** origin. Two consequences:

- The API must set them with `SameSite=None; Secure` in production, because
  `Lax` cookies are never sent on cross-site XHR requests or WebSocket
  handshakes. The server does this automatically when `NODE_ENV=production`
  (see `server/src/utils/cookies.ts`).
- `client/middleware.ts` cannot read cookies owned by another origin, so the
  client writes a first-party `session_hint` cookie after a successful
  login/register. The hint only drives navigation; every API request is still
  authorised by the HttpOnly tokens.

Safari's third-party cookie blocking will prevent sign-in while the API is on a
different site. Serving the API under the frontend's own domain (reverse proxy
or custom domain) is the durable fix.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start server
cd server
cp .env.example .env
# Edit .env with your values
pnpm run dev

# Start client (new terminal)
cd client
cp .env.example .env
pnpm run dev
```

## Docker

### Server

```bash
cd server
docker build -t quick-chat-server .
docker run -p 8000:8000 --env-file .env quick-chat-server
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  server:
    build: ./server
    ports:
      - "8000:8000"
    env_file:
      - ./server/.env
    depends_on:
      - mongodb
      - redis

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mongodb_data:
```

```bash
docker-compose up -d
```

## Production Build

### Server

```bash
cd server
pnpm run build
pnpm run start
```

### Client

```bash
cd client
pnpm run build
pnpm run start
```

## Deployment Platforms

### Vercel (Client)

1. Connect GitHub repository
2. Set root directory to `client`
3. Build command: `pnpm run build`
4. Output directory: `.next`
5. Add environment variables

### Render (Server)

1. Create Web Service
2. Build command: `cd server && pnpm install && pnpm run build`
3. Start command: `cd server && pnpm run start`
4. Add environment variables

### Railway (Full Stack)

1. Create project
2. Add MongoDB and Redis services
3. Deploy server and client as separate services
4. Configure environment variables

## Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server health check |
| `GET /api/health` | API health check |

## Monitoring

- **Logs**: Server uses Winston logger. Logs are structured JSON in production.
- **Metrics**: Consider adding Prometheus metrics for request duration, error rates.
- **Errors**: Use Sentry or similar for error tracking in production.

## Related Documentation

- [Architecture](ARCHITECTURE.md) — System design
- [Security](SECURITY.md) — Production security checklist
- [Server README](../server/README.md) — Server configuration
