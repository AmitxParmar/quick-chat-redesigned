# Engineering Decisions

> Technology tradeoffs and rationale.

[← Message Flow](MESSAGE_FLOW.md) · [API Reference →](API.md)

## MongoDB over PostgreSQL

**Decision:** MongoDB as the primary database.

**Tradeoffs:**
- Document model naturally fits chat data (messages, conversations, user profiles)
- Schema flexibility allows iterating on message formats without migrations
- Prisma provides type safety and query building while keeping MongoDB's flexibility
- No complex joins needed — chat data is denormalized by design

**Why not PostgreSQL:** Chat messages are self-contained documents. Relationships are simple (user→conversation, conversation→messages) and don't require relational integrity. MongoDB's document model avoids ORM complexity for nested data.

## Redis (Upstash) as Multi-Purpose Layer

**Decision:** Use Redis for caching, rate limiting, sessions, and idempotency.

**Tradeoffs:**
- Single dependency serves four purposes
- Upstash's serverless model means no infrastructure management
- TTL-based expiry simplifies cache invalidation
- Circuit breaker prevents cascading failures

**Why not separate services:** For a portfolio project, consolidating into Redis reduces operational complexity. The circuit breaker pattern handles the risk of a single point of failure.

## Socket.io over Raw WebSocket

**Decision:** Socket.io instead of native WebSocket.

**Tradeoffs:**
- Built-in reconnection and heartbeat
- Room-based event routing (join user rooms, emit to specific users)
- Redis adapter enables horizontal scaling across server instances
- Protocol overhead (~25 bytes per message)

**Why not raw WebSocket:** The reconnection logic, room management, and Redis adapter would need to be built from scratch. Socket.io's overhead is negligible for chat messages.

## IndexedDB (Dexie.js) for Offline Support

**Decision:** Local-first message persistence with Dexie.js.

**Tradeoffs:**
- Messages render instantly (optimistic updates)
- Works offline — messages queue and sync on reconnect
- Dexie provides a clean API over IndexedDB's complex API
- Data is device-local (no cross-device sync without additional work)

**Why not localStorage:** Storage limit (~5MB) is too small for chat history. IndexedDB handles structured data and large volumes efficiently.

## Zustand over Redux

**Decision:** Zustand for client state management.

**Tradeoffs:**
- Minimal boilerplate (no reducers, actions, or providers)
- Built-in TypeScript support
- Small bundle size (~1KB)
- No devtools middleware by default

**Why not Redux:** Redux requires significant boilerplate (actions, reducers, selectors, providers). For a chat app where state is primarily messages and conversations, Zustand's simplicity reduces code volume without sacrificing functionality.

## BullMQ for Background Jobs

**Decision:** Redis-backed queue for async processing.

**Tradeoffs:**
- Reliable job delivery with acknowledgment
- Delayed jobs for retry logic
- Built-in rate limiting
- Requires Redis (already using for caching)

**Why not in-process processing:** Background jobs (notifications, analytics) shouldn't block the request-response cycle. BullMQ provides persistence and retry logic that in-process solutions lack.

## Message Queue (Client-Side)

**Decision:** @tanstack/pacer for client-side message queuing.

**Tradeoffs:**
- Buffers messages when offline
- Configurable retry logic
- Integrates with IndexedDB for persistence
- Adds complexity to the send flow

**Why not direct HTTP calls:** Without a queue, messages fail immediately when offline. The queue enables offline resilience by persisting messages locally and retrying on reconnect.

## Module Structure

**Decision:** Controller → Service → Repository pattern.

**Tradeoffs:**
- Clear separation of concerns
- Easy to test individual layers
- Repository abstraction enables database swapping
- More files than a monolithic approach

**Why not a single file per feature:** The layered architecture scales better as features grow. Each layer has a single responsibility, making the codebase easier to navigate and maintain.

## JWT over Session Cookies

**Decision:** Stateless JWT tokens with refresh rotation.

**Tradeoffs:**
- No server-side session storage
- Token validation is O(1)
- Refresh token rotation limits token theft window
- Cannot revoke access tokens without additional infrastructure

**Why not session cookies:** JWTs are stateless — the server doesn't need to look up sessions. For a real-time chat server handling thousands of concurrent connections, avoiding session lookups reduces latency.

## Related Documentation

- [System Design](SYSTEM_DESIGN.md) — Implementation details
- [Performance](PERFORMANCE.md) — Optimization rationale
- [Security](SECURITY.md) — Security tradeoffs
