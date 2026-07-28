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
| `CLIENT_URL` | Yes | Frontend URL for CORS |
| `SWAGGER_ENABLED` | No | Enable Swagger UI (default: `false`) |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed origins |

### Client

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Backend API URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | No | WebSocket server URL (default: `ws://localhost:8000`) |

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
