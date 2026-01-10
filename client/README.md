# Quick Chat - Frontend

The frontend client for **Quick Chat** (a WhatsApp Clone), built with **Next.js 15**, **TypeScript**, and **Tailwind CSS**. It features a responsive UI, real-time updates via Socket.io, and state management with Zustand.

## 🚀 Features

- **Real-Time Interface**: Messages appear instantly. Typing indicators and status updates.
- **Responsive Design**: Mobile-first approach. Looks great on phones and desktops.
- **Themes**: Light and Dark mode support.
- **Authentication**: Secure login/signup flows with form validation.
- **Offline-First UI**: Optimistic updates for immediate user feedback.

---

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn/ui (Radix Primitives)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod

---

## ✅ Prerequisites

- Node.js >= 18.0.0
- Backend Server running on port 8000

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

3. **Set up Environment Variables**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   ```

---

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

### Production Build
```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
client/
├── app/                  # Next.js App Router Pages
│   ├── login/            # Auth pages
│   ├── (conversation)/   # Main Chat Interface
│   └── layout.tsx        # Root layout
├── components/           # React Components
│   ├── chat/             # Chat specific components (Bubble, Input, List)
│   ├── common/           # Shared components (Layouts, Loaders)
│   └── ui/               # Shadcn UI primitives (Buttons, Dialogs)
├── hooks/                # Custom Hooks (useMessages, useAuth)
├── services/             # API Service layer (Axios)
├── store/                # Zustand Stores (UserStore)
└── lib/                  # Utilities
```

## 🧪 Key Concepts

- **Optimistic UI**: When sending a message, it appears immediately in the chat list before the server confirms it. 
- **Socket Service**: A singleton service manages the WebSocket connection to prevent multiple connections.
- **Infinite Scroll**: Chat history loads incrementally as you scroll up.
