# Client

> Next.js 15 frontend for Quick Chat.

[← Documentation Index](docs/INDEX.md) · [Server →](server/README.md)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Offline**: Dexie.js (IndexedDB)
- **Realtime**: Socket.io Client
- **Virtualization**: @tanstack/react-virtual

## Project Structure

```
client/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth routes (login, register)
│   ├── (app)/              # Protected routes
│   │   ├── components/     # Chat interface components
│   │   └── page.tsx        # Main chat page
│   ├── api/                # API route handlers
│   └── layout.tsx          # Root layout
├── components/             # Shared UI components
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and API client
├── store/                  # Zustand state stores
└── utils/                  # Helper functions
```

## Key Components

### Chat Interface

```
app/(app)/components/
├── ChatHeader.tsx          # Conversation header with user info
├── ChatInput.tsx           # Message input with send button
├── ChatMessages.tsx        # Virtualized message list
├── MessageItem.tsx         # Individual message bubble
├── MessageStatus.tsx       # Delivery status indicators
├── ConversationsList.tsx   # Left sidebar conversation list
├── ConversationItem.tsx    # Individual conversation row
└── NoConversations.tsx     # Empty state
```

### State Management

**Zustand Stores:**

| Store | Purpose |
|-------|---------|
| `useAuthStore` | User authentication state |
| `useConversationStore` | Active conversation, message list |
| `useConversationsStore` | All conversations list |
| `useContactsStore` | Contact management |
| `useSocketStore` | Socket.io connection state |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useSocket` | Socket.io connection management |
| `useMessageHandler` | Message send/receive/status logic |
| `useChatScroll` | Auto-scroll behavior |
| `useDebounce` | Input debouncing |
| `useMediaQuery` | Responsive design |

## Offline Support

### IndexedDB Schema (Dexie.js)

```typescript
// lib/dexie.ts
class ChatDatabase extends Dexie {
  messages: Table<Message>;
  conversations: Table<Conversation>;
  contacts: Table<Contact>;
}
```

### Message Queue

Messages are queued locally when offline:

```typescript
// Uses @tanstack/pacer for retry logic
const messageQueue = new Queue({
  concurrency: 1,
  retryDelay: 1000,
  maxRetries: 3,
});
```

### Sync Strategy

1. Save to IndexedDB immediately (optimistic)
2. Attempt server delivery
3. On success: update status to `sent`
4. On failure: retry with exponential backoff
5. On reconnect: flush pending messages

## API Client

### Base Configuration

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  withCredentials: true,
});
```

### Interceptors

- **Request**: Attach access token from auth store
- **Response**: Handle 401 by refreshing token

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Production build |
| `pnpm run start` | Start production server |
| `pnpm run lint` | Run ESLint |

## Related Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design
- [Message Flow](docs/MESSAGE_FLOW.md) — Client-side message handling
- [Performance](docs/PERFORMANCE.md) — Client optimizations
