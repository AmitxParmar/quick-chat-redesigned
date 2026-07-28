# Message Flow

> End-to-end message delivery with sequence diagrams.

[← System Design](SYSTEM_DESIGN.md) · [Engineering Decisions →](ENGINEERING_DECISIONS.md)

## Happy Path: Send & Receive

```mermaid
sequenceDiagram
    participant A as Alice (Sender)
    participant CDB as Alice's IndexedDB
    participant Q as Message Queue
    participant S as Server
    participant M as MongoDB
    participant R as Redis
    participant B as Bob (Recipient)
    participant BDB as Bob's IndexedDB

    A->>CDB: Save message (pending)
    CDB-->>A: Render optimistic UI
    A->>Q: Enqueue message
    Q->>S: POST /api/messages
    S->>R: SET idempotency key (NX)
    S->>M: Insert message
    M-->>S: Created
    S->>R: Invalidate conversation cache
    S-->>Q: 201 Created
    Q->>CDB: Update status (sent)
    CDB-->>A: Update message bubble color

    S-->>B: Socket: message:receive
    B->>BDB: Save message
    B-->>S: Socket: message:delivered
    S-->>A: Socket: message:status (delivered)
    S->>R: Invalidate conversation cache for Bob

    B->>BDB: Mark as read
    B-->>S: Socket: message:read
    S-->>A: Socket: message:status (read)
    S->>R: Invalidate conversation cache for Alice
```

## Conversation Creation

```mermaid
sequenceDiagram
    participant A as Alice
    participant S as Server
    participant M as MongoDB
    participant R as Redis
    participant B as Bob

    A->>S: POST /api/messages {to: bobId, content}
    S->>S: normalizeWaId(to)
    S->>M: Find conversation where participants = [alice, bob]
    alt Existing conversation
        M-->>S: conversationId
    else New conversation
        S->>S: Generate UUID (pre-generated)
        S->>M: Insert conversation + message (atomic)
        S->>R: Invalidate caches
        M-->>S: Created
    end
    S->>R: Invalidate conversation list cache
    S-->>A: 201 Created
    S-->>B: Socket: message:receive
    S-->>B: Socket: conversation:create
```

## Read Receipts

```mermaid
sequenceDiagram
    participant A as Alice
    participant S as Server
    participant M as MongoDB
    participant R as Redis

    Note over A: Opens conversation
    A->>S: GET /api/messages/conversations/:id
    S->>M: Find conversation
    S->>M: Find user
    S->>S: isUserParticipant check
    S->>M: Find messages (from/to = userId, status ≠ read)
    S->>M: Update many → status = read
    S->>R: Invalidate caches
    S-->>A: {messages, otherUser}

    Note over A,S: After 500ms debounce
    A->>S: Socket: message:read (conversationId)
    S-->>A: Socket: message:read:ack
    S-->>B: Socket: message:status (read)
```

## Offline Recovery

```mermaid
sequenceDiagram
    participant A as Alice (Offline)
    participant CDB as IndexedDB
    participant Q as Message Queue
    participant S as Server

    Note over A: Alice goes offline
    A->>CDB: Save message (pending)
    A->>Q: Enqueue (fails, stored locally)

    Note over A: Alice comes back online
    A->>S: Socket connect
    S-->>A: Connected
    A->>Q: Retry pending messages
    Q->>S: POST /api/messages
    S-->>Q: 201 Created
    Q->>CDB: Update status (sent)
    CDB-->>A: Update message status
```

## Message Deduplication

Messages can arrive via both HTTP response and WebSocket. The client handles this:

```typescript
// client/hooks/useMessageHandler.ts
const handleMessageReceive = useCallback((message) => {
  if (conversationId && message.conversationId === conversationId) {
    addMessage(message); // Zustand store handles dedup by ID
  }
}, [conversationId]);
```

The `addMessage` function checks if a message with the same `id` already exists before adding.

## Delivery Status UI

```mermaid
graph LR
    A[Message Bubble] --> B{Status}
    B -->|pending| C[Clock icon]
    B -->|sent| D[Single check]
    B -->|delivered| E[Double check gray]
    B -->|read| F[Double check blue]
    B -->|failed| G[Red exclamation]
```

## Related Documentation

- [System Design](SYSTEM_DESIGN.md) — Auth and caching flows
- [API Reference](API.md) — HTTP and WebSocket endpoints
- [Client README](../client/README.md) — useMessageHandler hook
