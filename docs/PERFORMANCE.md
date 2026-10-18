# Performance

> Optimizations, caching, and scalability.

[← Deployment](DEPLOYMENT.md) · [Security →](SECURITY.md)

## Client Performance

### Virtualized Lists

The conversation list uses `@tanstack/react-virtual` to render only visible items. For 1000 conversations, only ~10-15 DOM nodes exist at any time.

```typescript
// client/app/(app)/components/ConversationsList.tsx
const virtualizer = useVirtualizer({
  count: conversations.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 76, // pixels per item
  overscan: 5,
});
```

### Memoization

- `React.memo()` on heavy components (MessageItem, ContactItem)
- `useMemo()` for filtered/sorted lists
- `useCallback()` for event handlers passed to children
- Zustand selectors with shallow equality

### Bundle Optimization

- Next.js dynamic imports for route-based code splitting
- Tree-shaking for lodash (import individual functions)
- Image optimization with Next.js Image component
- Font optimization with next/font

### Offline Performance

- IndexedDB reads are synchronous (no async overhead)
- Messages render from local cache instantly
- Network requests happen in background

### Service Worker

- `public/sw.js` handles push notifications **and** runtime caching.
- `/_next/static/*` is cached cache-first (immutable, content-hashed).
- Navigations are network-first with cached fallback to `/`.
- Images/fonts are stale-while-revalidate with bounded cache sizes.
- API routes and RSC payloads are deliberately not cached.

## Server Performance

### Caching

| Operation | Cache Strategy | TTL |
|-----------|---------------|-----|
| User profile | Cache-aside | 1 hour |
| Conversation messages | Cache-aside | 5 minutes |
| User conversations | Cache-aside | 5 minutes |
| Online status | Write-through | 60 seconds |

### Database Optimization

**Indexes:**
```prisma
model Message {
  id        String   @id @default(auto()) @map("_id")
  from      String   @db.VarChar(100)
  to        String   @db.VarChar(100)
  status    String   @default("sent") @db.VarChar(20)
  // ...
  @@index([from])
  @@index([to])
  @@index([status])
}

model Conversation {
  id        String   @id @default(auto()) @map("_id")
  updatedAt DateTime @updatedAt
  // ...
  @@index([updatedAt])
}
```

**Query Optimization:**
- Single-query conversation lookup with `OR` clause
- Select only required fields (`select: { id: true, name: true }`)
- Batch operations with `Promise.all` instead of sequential awaits

### Connection Pooling

Prisma manages connection pooling automatically. For high-concurrency scenarios:

```typescript
// server/prisma/index.ts
new PrismaClient({
  datasources: {
    db: {
      url: process.env.MONGODB_URI,
    },
  },
});
```

### Rate Limiting

Sliding window counter in Redis:

```typescript
// Key: rate_limit:{identifier}:{endpoint}
// Value: count
// TTL: window duration
```

## Scalability

### Horizontal Scaling

Socket.io with Redis adapter enables multiple server instances:

```typescript
// server/src/lib/socket.ts
const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

Messages published to one instance are broadcast to all instances via Redis Pub/Sub.

### Database Scaling

- **Read replicas**: Add MongoDB read replicas for read-heavy operations
- **Sharding**: Shard by conversation ID for horizontal data distribution
- **Archiving**: Move old messages to cold storage

### Cache Scaling

Upstash Redis scales automatically. For self-hosted Redis:
- Use Redis Cluster for horizontal scaling
- Implement cache sharding by user ID

## Latency Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Message send (optimistic) | <50ms | ~10ms (local) |
| Message send (server) | <100ms | ~50-80ms |
| Message receive | <200ms | ~100-150ms |
| Conversation list load | <300ms | ~100-200ms |
| Search | <500ms | ~200-400ms |

## Monitoring

### Key Metrics

- **Message latency**: Time from send to receive
- **Cache hit rate**: Percentage of cache hits vs misses
- **Error rate**: Percentage of failed requests
- **Connection count**: Active WebSocket connections
- **Memory usage**: Server and Redis memory

### Logging

```typescript
// Structured logging with Winston
logger.info('Message sent', {
  messageId: message.id,
  conversationId,
  latency: Date.now() - startTime,
});
```

## Related Documentation

- [System Design](SYSTEM_DESIGN.md) — Caching strategy
- [Engineering Decisions](ENGINEERING_DECISIONS.md) — Technology tradeoffs
- [Server README](../server/README.md) — Infrastructure details
