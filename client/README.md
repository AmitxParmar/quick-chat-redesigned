# Quick Chat - Frontend

The **Quick Chat** frontend is a modern, responsive WhatsApp-style chat interface built with **Next.js 15**, **TypeScript**, and **Tailwind CSS**. Features real-time messaging via Socket.io with advanced offline capabilities and high-performance rendering.

## 🚀 Key Features

- **Real-Time Chat**: Instant message delivery with typing indicators and status updates
- **Offline-First UI**: Local message queuing and optimistic updates for seamless offline experience
- **Responsive Design**: Mobile-first approach optimized for all device sizes
- **Performance Optimized**: Virtualization for smooth 60 FPS rendering of 10,000+ messages
- **Accessibility**: WCAG compliant with proper ARIA labels and keyboard navigation
- **Dark Mode**: Theme switching with persistence

---

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router) - Server-side rendering
- **Language:** TypeScript - Full type safety
- **Styling:** Tailwind CSS + Shadcn/ui (Radix Primitives)
- **State Management:** Zustand - Lightweight reactive state management
- **HTTP Client:** Axios - API communication
- **Icons:** Lucide React - Feature-rich icon set
- **Forms:** React Hook Form + Zod - Type-safe forms

---

## ✅ Prerequisites

- Node.js >= 18.0.0
- Backend server running on port 8000

---

## 📦 Installation

1. **Navigate to client directory**
   ```bash
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
   ```

   **Note:** Port `8000` for the backend and `3000` for the frontend should match your deployment environment

---

## 🏃 Running the Application

### Development Mode
```bash
pnpm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

### Production Build
```bash
pnpm run build
pnpm start
```

---

## 📁 Project Structure

```
client/
├── app/                  # Next.js App Router Pages
│   ├── login/            # Authentication pages
│   ├── (conversation)/   # Main chat interface (dynamic routes)
│   └── layout.tsx        # Root layout with providers and error boundaries
├── components/           # Reusable React components
│   ├── chat/             # Chat-specific components (MessageBubbles, MessageInput, ChatList)
│   ├── common/           # Layout components and loading states
│   └── ui/               # Shadcn UI component primitives
├── hooks/                # Custom React hooks
│   ├── useAuth.ts        # Authentication state management
│   ├── useMessages.ts    # Chat history and sending logic
│   └── useSocket.ts      # WebSocket connection management
├── services/             # API and background services
│   ├── api-client.ts     # HTTP API client (Axios configuration)
│   └── message-queue.ts  # Background job queue for offline messages
├── store/                # Zustand application stores
│   ├── userStore.ts      # User authentication and profile state
│   └── chatStore.ts      # Chat UI and state management
└── lib/                  # Utility functions and formatters
```

---

## 🧪 Key Implementation Details

- **Optimistic UI**: Message appears immediately in chat when sent, status updates (sent/delivered/read) reflected instantly
- **Socket Service**: Singleton WebSocket connection management prevents multiple connection issues
- **Infinite Scroll**: Chat history loads incrementally with virtualization for performance
- **Message Queue Service**: Handles offline message queuing with retry logic and background sync
- **IndexedDB Integration**: Local message persistence for offline-first capabilities
- **Error Boundaries**: Graceful error handling throughout the UI
- **Responsive Breakpoints**: Mobile-first design with responsive chat layouts

---

## 🔧 Performance Optimizations

- **Virtualization**: Renders only visible messages for 60 FPS performance at scale
- **Infinite Scroll**: Lazy-loads chat history without loading entire conversation
- **Local Storage**: IndexedDB for offline message persistence
- **WebSocket**: Real-time bidirectional communication with reconnection logic
- **Bundle Optimization**: Code splitting and tree-shaking for fast loading

---

## 📊 Development Setup

### Running Both Client and Server

```bash
# Terminal 1 (Backend)
cd server
pnpm install
pnpm run dev
# Server: http://localhost:8000

# Terminal 2 (Frontend)
cd client
pnpm install
pnpm run dev
# Client: http://localhost:3000
```

### Docker Deployment (Backend)

```bash
cd server
docker build -t quick-chat-client .
docker run -p 8000:8000 quick-chat-client
```

See [Server README](../server/README.md) for deployment instructions (Render, AWS, etc.).
