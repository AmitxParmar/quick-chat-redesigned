# Quick Chat - Analysis & Documentation

**Quick Chat** is a modern, full-stack WhatsApp Clone designed for learning production-grade architecture. It features real-time messaging, secure authentication, and a scalable codebase.

## 📚 Documentation

- **[Frontend Documentation](./client/README.md)**: Next.js Client, UI components, and State Management.
- **[Backend Documentation](./server/README.md)**: Node.js Server, API Endpoints, and Docker Deployment.

---

## 📁 Project Structure

The project is organized as a monorepo with distinct Client and Server applications.

### 🖥️ Client (`/client`)
Built with **Next.js 15**, **Tailwind**, and **Zustand**.
- `app/`: App Router pages.
- `components/`: UI and Chat components.
- `services/`: API integration.

### ⚙️ Server (`/server`)
Built with **Node.js**, **Express**, **Prisma**, and **Socket.io**.
- `src/modules/`: Feature-based modules (Auth, User, Message).
- `src/lib/`: Core infrastructure (Socket, Logger, Prisma).
- `prisma/`: Database schema.
- `Dockerfile`: Production deployment configuration.

---

## 🚀 Quick Start

1. **Clone the Repo**
   ```bash
   git clone <repo-url>
   cd quick-chat
   ```

2. **Start Backend**
   ```bash
   cd server
   pnpm install
   pnpm run dev
   ```

3. **Start Frontend** (in a new terminal)
   ```bash
   cd client
   pnpm install
   pnpm run dev
   ```

4. **Visit App**
   Open `http://localhost:3000`.

---

## 🐳 Docker Support

To run the backend in a container:

```bash
cd server
docker build -t quick-chat-server .
docker run -p 8000:8000 quick-chat-server
```

See [Server README](./server/README.md) for full deployment instructions (Render, etc).

---

## 📡 Message System Architecture

Quick Chat uses a **Local-First** architecture with **Socket.io Relay** for real-time messaging. This ensures messages are instantly available to the sender and delivered in real-time to recipients without relying on server-side database persistence for the message content itself.

### Key Concepts

1.  **Local Storage (Dexie.js)**: All messages (sent and received) are stored locally in the user's browser using IndexedDB. This allows for offline access and instant UI updates (Optimistic UI).
2.  **Socket.io Relay**: The server acts as a relay. It accepts a message from the sender and immediately broadcasts it to the recipient(s). It does *not* save the message content to MongoDB.
3.  **Delivery Status**:
    *   **Single Tick**: Message saved locally and sent to server.
    *   **Double Tick (Delivered)**: Recipient received the message and acknowledged it via a socket event.
    *   **Blue Tick (Read)**: Recipient opened the chat and the app emitted a read receipt.
4.  **Offline Capability**: If a recipient is offline, the sender's client listens for the `user:online` event. When the recipient comes online, the sender's client automatically resends any pending messages.

### Message Flow Diagram

```mermaid
sequenceDiagram
    participant UA as User A (Sender)
    participant S as Server (Socket.io)
    participant UB as User B (Recipient)

    Note over UA, UB: Local-First Messaging Flow

    %% Sending Message
    UA->>UA: Save to Dexie (Status: Sent 1-tick)
    UA->>S: emit('message:send', msg)
    
    %% Relaying
    S->>UB: emit('message:created', msg)
    
    alt User B is Online
        UB->>UB: Save to Dexie
        UB-->>S: emit('message:status-updated', Delivered)
        S-->>UA: emit('message:status-updated', Delivered)
        UA->>UA: Update Dexie (Status: Delivered 2-ticks)
    else User B is Offline
        Note right of S: Message dropped (No persistence)
        Note right of UA: Message remains Sent (1-tick)
        
        %% Offline Retry Flow
        UB->>S: Connects (emit 'connection')
        S->>UA: emit('user:online', { waId: UB })
        UA->>UA: Query Pending Messages
        UA->>S: Re-emit('message:send', msg)
        S->>UB: emit('message:created', msg)
        UB-->>S: emit('message:status-updated', Delivered)
        S-->>UA: emit('message:status-updated', Delivered)
    end

    %% Read Receipt
    Note over UB: User B opens chat
    UB->>S: emit('messages:marked-as-read')
    S->>UA: emit('messages:marked-as-read')
    UA->>UA: Update Dexie (Status: Read Blue-ticks)
```
