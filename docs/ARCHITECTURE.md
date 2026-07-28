# Architecture

> High-level system design and component relationships.

[← Index](INDEX.md) · [System Design →](SYSTEM_DESIGN.md)

## System Overview

Quick Chat follows a client-server architecture with a local-first messaging strategy. The client handles message persistence and UI rendering, while the server manages authentication, message routing, and horizontal scaling.

```mermaid
graph TB
    subgraph "Client (Next.js 15)"
        UI[React UI]
        DB[(IndexedDB<br/>Dexie.js)]
        SI[Socket.io Client]
        Q[Message Queue<br/>@tanstack/pacer]
    end

    subgraph "Server (Node.js + Express)"
        API[REST API]
        AUTH[Auth Service]
        MSG[Message Service]
        CONV[Conversation Service]
    end

    subgraph "Infrastructure"
        MONGO[(MongoDB)]
        REDIS[(Redis<br/>Upstash)]
        BQ[BullMQ<br/>Redis-backed]
        WORKER[Chat Worker]
    end

    UI -- "HTTP" --> API
    UI -- "writes/reads" --> DB
    Q -- "enqueue" --> DB
    SI -- "WebSocket" --> MSG
    API --> AUTH
    API --> CONV
    API --> MSG
    AUTH --> REDIS
    MSG --> MONGO
    MSG --> REDIS
    MSG --> BQ
    BQ --> WORKER
    SI -- "Redis Pub/Sub" --> SI
```

## Components

### Client

| Component | Responsibility |
|-----------|---------------|
| **React UI** | Renders chat interface, conversation list, contacts |
| **IndexedDB (Dexie.js)** | Local message persistence for offline support and optimistic updates |
| **Socket.io Client** | Real-time bidirectional communication |
| **Message Queue** | Buffers outbound messages with retry logic when offline |

### Server

| Component | Responsibility |
|-----------|---------------|
| **REST API** | Authentication, conversation CRUD, message history, contacts |
| **Socket.io Server** | Real-time message relay, status updates, presence |
| **Auth Service** | JWT token management, session lifecycle, single-device enforcement |
| **Message Service** | Message persistence, cache invalidation, delivery tracking |
| **Conversation Service** | Conversation creation, read receipts, participant management |

### Infrastructure

| Component | Responsibility |
|-----------|---------------|
| **MongoDB** | Primary data store for users, messages, conversations |
| **Redis (Upstash)** | Caching layer, rate limiting, session management, idempotency keys |
| **BullMQ** | Background job processing for notifications and analytics |
| **Redis Pub/Sub** | Horizontal scaling of Socket.io across multiple server instances |

## Data Flow

### Message Send

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant R as Redis
    participant M as MongoDB

    C->>C: Save to IndexedDB (pending)
    C->>S: HTTP POST /messages
    S->>R: Check idempotency (SET NX)
    S->>M: Persist message
    S->>R: Invalidate caches
    S-->>C: 201 Created
    C->>C: Update status (sent)
    C-->>S: Socket message:send
    S->>S: Validate + relay
    S-->>C: Ack
    S-->>C: Emit to recipient
```

### Connection Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Socket Server
    participant R as Redis

    C->>S: Connect (cookie auth)
    S->>S: Verify JWT
    S->>S: Join user room
    S->>R: Set online (TTL 60s)
    S-->>C: user:online

    loop Every 30s
        S->>R: Refresh online status
    end

    C-xS: Disconnect
    S->>R: Delete online status
    S->>S: Emit user:offline
```

## Module Boundaries

```
server/src/modules/
├── auth/          # Authentication + authorization
├── user/          # User profiles + push subscriptions
├── message/       # Message CRUD + delivery tracking
├── conversation/  # Chat rooms + read receipts
└── contact/       # Contact management + search
```

Each module follows the same internal structure:

```
module/
├── *.controller.ts   # HTTP request handling
├── *.service.ts      # Business logic
├── *.repository.ts   # Database queries
├── *.route.ts        # Route definitions + middleware
└── *.dto.ts          # Request validation schemas
```

## Related Documentation

- [System Design](SYSTEM_DESIGN.md) — Detailed flow diagrams
- [Server README](../server/README.md) — Backend infrastructure
- [Client README](../client/README.md) — Frontend architecture
