# Server

> Node.js + Express backend for Quick Chat.

[← Client](client/README.md) · [Documentation Index →](docs/INDEX.md)

## Tech Stack

- **Runtime**: Node.js 22
- **Framework**: Express
- **Language**: TypeScript
- **Database**: MongoDB (Prisma ORM)
- **Cache**: Redis (Upstash)
- **Realtime**: Socket.io with Redis Pub/Sub
- **Queue**: BullMQ
- **Validation**: Zod
- **Auth**: JWT (access + refresh tokens)

## Project Structure

```
server/
├── src/
│   ├── lib/                # Core infrastructure
│   │   ├── app.ts          # Express app setup
│   │   ├── prisma.ts       # Database client
│   │   ├── redis.ts        # Redis client
│   │   ├── cache.ts        # Cache service
│   │   ├── socket.ts       # Socket.io setup
│   │   ├── queue.ts        # BullMQ queue
│   │   └── environment.ts  # Env validation
│   ├── modules/            # Feature modules
│   │   ├── auth/           # Authentication
│   │   ├── user/           # User management
│   │   ├── message/        # Messages
│   │   ├── conversation/   # Conversations
│   │   └── contact/        # Contacts
│   ├── middleware/          # Express middleware
│   ├── types/              # TypeScript types
│   ├── utils/              # Helper functions
│   └── server.ts           # Entry point
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed data
├── Dockerfile
└── tsconfig.json
```

## Module Structure

Each module follows the same pattern:

```
module/
├── *.controller.ts   # Request handling
├── *.service.ts      # Business logic
├── *.repository.ts   # Database queries
├── *.route.ts        # Route definitions
├── *.dto.ts          # Validation schemas
└── *.types.ts        # TypeScript types
```

### Modules

| Module | Responsibility |
|--------|---------------|
| `auth` | Login, register, token refresh, logout |
| `user` | Profile management, push subscriptions |
| `message` | Send, receive, status updates, history |
| `conversation` | Create, list, read receipts, naming |
| `contact` | Add, remove, search contacts |

## Core Infrastructure

### Express App (`lib/app.ts`)

- Helmet security headers
- CORS configuration
- JSON body parsing (10KB limit)
- Cookie parsing
- Rate limiting middleware
- Swagger UI (optional)

### Database (`lib/prisma.ts`)

```typescript
// Singleton Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});
```

### Cache (`lib/cache.ts`)

```typescript
// Cache-aside pattern with circuit breaker
const cacheService = {
  async get<T>(key: string): Promise<T | null> { ... },
  async set(key: string, value: any, ttl: number): Promise<void> { ... },
  async invalidate(...keys: string[]): Promise<void> { ... },
};
```

**Circuit Breaker:** Opens after 3 consecutive Redis failures, half-open after 30 seconds.

### Socket.io (`lib/socket.ts`)

```typescript
// Redis adapter for horizontal scaling
io.adapter(createAdapter(pubClient, subClient));

// Room-based routing
socket.join(`user:${userId}`);
io.to(`user:${userId}`).emit('message:receive', message);
```

### Queue (`lib/queue.ts`)

```typescript
// BullMQ for background jobs
const chatQueue = new Queue('chat', { connection: redis });
const chatWorker = new Worker('chat', processJob, { connection: redis });
```

## Database Schema

### User

```prisma
model User {
  id            String    @id @default(auto()) @map("_id")
  phone         String    @unique @db.VarChar(20)
  name          String    @db.VarChar(100)
  password      String    @db.VarChar(100)
  about         String    @default("Hey there! I am using WhatsApp") @db.VarChar(200)
  avatarUrl     String?   @db.VarChar(500)
  lastSeen      DateTime  @default(now())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Message

```prisma
model Message {
  id              String    @id @default(auto()) @map("_id")
  from            String    @db.VarChar(100)
  to              String    @db.VarChar(100)
  content         String    @db.VarChar(5000)
  status          String    @default("sent") @db.VarChar(20)
  conversationId  String    @map("conversation_id") @db.VarChar(100)
  createdAt       DateTime  @default(now())

  @@index([from])
  @@index([to])
  @@index([status])
}
```

### Conversation

```prisma
model Conversation {
  id            String    @id @default(auto()) @map("_id")
  name          String?   @db.VarChar(100)
  isGroup       Boolean   @default(false) @map("is_group")
  participants  String[]
  lastMessage   String?   @map("last_message") @db.VarChar(500)
  unreadCount   Int       @default(0) @map("unread_count")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([updatedAt])
}
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/refresh` | Refresh token |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/messages` | Send message |
| `GET` | `/api/messages/:id` | Get message |
| `GET` | `/api/messages/conversations/:id` | Get conversation messages |
| `POST` | `/api/conversations` | Create conversation |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Get conversation |
| `PUT` | `/api/conversations/:id` | Update conversation |
| `DELETE` | `/api/conversations/:id` | Delete conversation |
| `POST` | `/api/conversations/:id/read` | Mark as read |
| `PUT` | `/api/conversations/:id/name` | Update group name |
| `GET` | `/api/users` | List users |
| `GET` | `/api/users/me` | Get profile |
| `PUT` | `/api/users/me` | Update profile |
| `POST` | `/api/users/me/subscription` | Save push subscription |
| `POST` | `/api/contacts` | Add contact |
| `GET` | `/api/contacts` | List contacts |
| `GET` | `/api/contacts/:id` | Get contact |
| `PUT` | `/api/contacts/:id` | Update contact |
| `DELETE` | `/api/contacts/:id` | Remove contact |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Compile TypeScript |
| `pnpm run start` | Start production server |
| `pnpm run lint` | Run ESLint |
| `pnpm run db:push` | Push schema to database |
| `pnpm run db:seed` | Seed database |
| `pnpm run db:studio` | Open Prisma Studio |

## Related Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design
- [API Reference](docs/API.md) — Complete API docs
- [Security](docs/SECURITY.md) — Security implementation
