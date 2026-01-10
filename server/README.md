# Quick Chat - Backend API

A production-ready RESTful API for **Quick Chat** (a WhatsApp Clone) built with Node.js, Express, TypeScript, and Prisma (MongoDB). Features real-time messaging via Socket.io, JWT authentication, and a modular architecture.

## 🚀 Features

- **Real-Time Messaging**: Socket.io integration for instant message delivery and status updates (Sent/Delivered/Read).
- **Secure Authentication**: JWT-based auth with Access & Refresh tokens + HttpOnly cookies.
- **Modular Architecture**: Feature-based folder structure (User, Auth, Message, Conversation modules).
- **Database**: MongoDB with Prisma ORM.
- **Rate Limiting**: Protection against abuse.
- **Docker Ready**: Multi-stage Dockerfile for optimized production deployment.
- **API Documentation**: Swagger/OpenAPI support (at `/v1/swagger`).

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [Docker Deployment](#-docker-deployment)
- [Architecture](#-architecture)
- [API Endpoints](#-api-endpoints)

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js (v20+) | JavaScript runtime |
| **Framework** | Express.js | Web framework |
| **Language** | TypeScript | Type safety |
| **Database** | MongoDB | NoSQL database |
| **ORM** | Prisma | Database toolkit |
| **Real-Time** | Socket.io | WebSocket communication |
| **Authentication** | JWT + bcrypt | Secure auth |
| **Validation** | Zod / class-validator | Input validation |

---

## ✅ Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- MongoDB instance (local or cloud)

---

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd quick-chat/server
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate Prisma client**
   ```bash
   pnpm run prisma:generate
   ```

---

## 🔐 Environment Variables

Create a `.env` file in the `server` directory:

```env
# Server Configuration
NODE_ENV=development
PORT=8000
APP_BASE_URL=http://localhost

# Database
DATABASE_URL="mongodb://localhost:27017/quick-chat?authSource=admin"

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000

# JWT Secrets (Generate strong random strings)
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

---

## 🏃 Running the Application

### Development Mode
```bash
pnpm run dev
```
Server starts at `http://localhost:8000`

### Production Build
```bash
pnpm run build
pnpm start
```

---

## 🐳 Docker Deployment

The application includes a production-ready `Dockerfile`.

### Build & Run locally
```bash
# Build image
docker build -t quick-chat-server .

# Run container
docker run -p 8000:8000 --env-file .env quick-chat-server
```

### Deploy on Render (Docker Runtime)
1. Create a **New Web Service**.
2. Connect your repo.
3. Select **Docker** as the Runtime.
4. Set **Root Directory** to `server`.
5. Add your Environment Variables.
6. Deploy!

---

## 🏗 Architecture

### Project Structure (Module-based)

```
server/
├── src/
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Authentication Logic
│   │   ├── user/         # User Management
│   │   ├── message/      # Message Handling
│   │   ├── conversation/ # Chat Management
│   │   └── contact/      # Contact syncing
│   ├── lib/              # Core libraries (Prisma, Socket, Logger)
│   ├── middlewares/      # Express middlewares (Auth, Rate Limit)
│   ├── config/           # App Configuration
│   ├── app.ts            # App Setup
│   └── index.ts          # Entry Point
├── prisma/
│   └── schema.prisma     # DB Schema
└── Dockerfile            # Deployment Config
```

---

## � API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh Token
- `GET /api/v1/auth/me` - Get current user profile

### Messages
- `POST /api/v1/messages` - Send a message
- `GET /api/v1/messages/:conversationId` - Get chat history

### Conversations
- `GET /api/v1/conversations` - Get all chats
- `PUT /api/v1/conversations/:id/read` - Mark chat as read

For full documentation, run the server and visit:
`http://localhost:8000/v1/swagger`
