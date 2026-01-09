# Collaborative Task Manager - Backend API

A production-ready RESTful API for a collaborative task management application built with Node.js, Express, TypeScript, and MongoDB. Features real-time updates via Socket.io, JWT authentication, and comprehensive task management capabilities.

## 🚀 Features

- **Secure Authentication**: JWT-based auth with HTTP-only cookies and refresh token rotation
- **Task Management**: Full CRUD operations with filtering, sorting, and advanced queries
- **Real-Time Updates**: Socket.io integration for instant task updates and notifications
- **Session Management**: Persistent sessions with refresh token storage
- **Type Safety**: Full TypeScript implementation with strict typing
- **Clean Architecture**: Repository-Service-Controller pattern for maintainability
- **Validation**: Request validation using class-validator and DTOs
- **Database**: MongoDB with Prisma ORM
- **API Documentation**: Auto-generated Swagger/OpenAPI docs

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [Socket.io Integration](#-socketio-integration)
- [Testing](#-testing)

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js (v16+) | JavaScript runtime |
| **Framework** | Express.js | Web framework |
| **Language** | TypeScript | Type safety |
| **Database** | MongoDB | NoSQL database |
| **ORM** | Prisma | Database toolkit |
| **Authentication** | JWT + bcrypt | Secure auth |
| **Real-Time** | Socket.io | WebSocket communication |
| **Validation** | class-validator | DTO validation |
| **Documentation** | Swagger/OpenAPI | API docs |
| **Package Manager** | pnpm | Fast, disk-efficient |

---

## ✅ Prerequisites

- Node.js >= 16.0.0
- pnpm (recommended) or npm
- MongoDB instance (local or cloud)

---

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaboration-task-manager/server
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

5. **Run database migrations (if applicable)**
   ```bash
   pnpm run prisma:migrate
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
DATABASE_URL=mongodb://localhost:27017/task-manager

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000

# JWT Secrets (change in production!)
JWT_ACCESS_SECRET=your-secure-access-secret-key
JWT_REFRESH_SECRET=your-secure-refresh-secret-key
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

### Other Commands
```bash
# Type checking
pnpm run check:types

# Linting
pnpm run lint
pnpm run lint:fix

# Code formatting
pnpm run format

# Prisma Studio (Database GUI)
pnpm run prisma:studio

# Run tests
pnpm run test
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:8000/api/v1/development
```

### Swagger UI
```
http://localhost:8000/v1/swagger
```

### API Endpoints

#### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/logout` | Logout (clear session) | No |
| POST | `/auth/logout-all` | Logout all devices | Yes |
| POST | `/auth/refresh` | Refresh access token | Cookie |
| GET | `/auth/me` | Get current user | Yes |

#### Task Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/tasks` | Create task | Yes |
| GET | `/tasks` | Get all tasks (with filters) | Yes |
| GET | `/tasks/:id` | Get task by ID | Yes |
| PUT | `/tasks/:id` | Update task | Yes |
| DELETE | `/tasks/:id` | Delete task | Yes |

#### Task Query Parameters

- `status`: Filter by status (TODO, IN_PROGRESS, REVIEW, COMPLETED)
- `priority`: Filter by priority (LOW, MEDIUM, HIGH, URGENT)
- `assignedToMe=true`: Tasks assigned to current user
- `createdByMe=true`: Tasks created by current user
- `overdue=true`: Overdue tasks
- `sortByDueDate`: Sort order (`asc` or `desc`)

---

## 💡 Design Decisions

### Database Selection: MongoDB
I chose **MongoDB** for this project for several key reasons:
1.  **Flexible Schema**: Task management systems often evolve. MongoDB's schema-less nature allows me to easily add new fields (like custom tags, checklists, or dynamic attachments) to tasks without complex migrations.
2.  **JSON Native**: Being a full-stack JavaScript application (Node.js + React), storing data as BSON (Binary JSON) simplifies the data flow. Objects retrieved from the DB map directly to my TypeScript interfaces without impedence mismatch.
3.  **Scalability**: MongoDB's document model is well-suited for read-heavy dashboards where I need to fetch a task and all its related metadata (comments, history) in a single query.

### Authentication: JWT with Access & Refresh Tokens
I implemented a robust dual-token system:
- **Access Token**: Short-lived (15 min), useful for authenticating API requests.
- **Refresh Token**: Long-lived (7 days), stored securely in an **HTTP-only cookie**. This protects against XSS attacks since the client JavaScript cannot access the long-term secret, while still allowing for seamless "keep-me-logged-in" functionality.

### Service Layer Pattern
I separated business logic (Services) from HTTP transport (Controllers) and Data Access (Repositories). This separation ensures that my business rules (e.g., "User A can only edit their own tasks") are testable in isolation without mocking Express request/response objects.

### Trade-offs & Assumptions
- **Assumption**: A user can see all other users in the system to assign tasks. In a real multi-tenant SaaS, this would be restricted to the same "Organization".
- **Trade-off**: I chose **JWTs** for statelessness over server-side sessions. The trade-off is that instant revocation of a specific access token is harder (requires a blacklist or short expiry). I mitigated this by setting a short 15-minute expiry for access tokens.
- **Trade-off**: **MongoDB** lacks the rigid referential integrity of SQL. I handle relations (like User-Task) at the application level using Prisma, accepting slightly more complex application logic for greater development speed and flexibility.

---

## 🏗 Architecture

### Project Structure

```
server/
├── src/
│   ├── config/           # Configuration files
│   ├── decorators/       # Custom decorators
│   ├── dto/              # Data Transfer Objects
│   │   ├── user.dto.ts
│   │   └── task.dto.ts
│   ├── enums/            # Enum definitions
│   ├── lib/              # Core libraries
│   │   ├── api.ts        # Base API class
│   │   ├── jwt.ts        # JWT service
│   │   ├── password.ts   # Password hashing
│   │   ├── socket.ts     # Socket.io service
│   │   └── prisma.ts     # Prisma client
│   ├── middlewares/      # Express middlewares
│   │   ├── auth.ts       # JWT verification
│   │   ├── error-handler.ts
│   │   └── request-validator.ts
│   ├── modules/          # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.route.ts
│   │   └── task/
│   │       ├── task.repository.ts
│   │       ├── task.service.ts
│   │       ├── task.controller.ts
│   │       └── task.route.ts
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   ├── app.ts            # Express app configuration
│   ├── server.ts         # HTTP server + Socket.io
│   └── index.ts          # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
└── tests/                # Test files
```

### Design Pattern: Repository-Service-Controller

```
Client Request
      ↓
  Controller (HTTP layer)
      ↓
   Service (Business logic)
      ↓
  Repository (Data access)
      ↓
   Prisma ORM
      ↓
   MongoDB
```

**Benefits:**
- Clear separation of concerns
- Easy to test each layer independently
- Maintainable and scalable
- Follows SOLID principles

---

## 🗄 Database Schema

### User Model
```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  
  tasksCreated  Task[]  @relation("TaskCreator")
  tasksAssigned Task[]  @relation("TaskAssignee")
  sessions      Session[]
  notifications Notification[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Task Model
```prisma
model Task {
  id          String   @id @default(uuid())
  title       String
  description String
  dueDate     DateTime
  priority    Priority
  status      Status
  
  creatorId    String
  assignedToId String
  
  creator  User @relation("TaskCreator")
  assignee User @relation("TaskAssignee")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Enums
```prisma
enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum Status {
  TODO
  IN_PROGRESS
  REVIEW
  COMPLETED
}
```

---

## 🔌 Socket.io Integration

### Connection

```javascript
// Client-side example
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
  auth: {
    token: 'your-access-token'
  }
});
```

### Events

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `task:created` | `{ taskId, task }` | Broadcast when task created |
| `task:updated` | `{ taskId, task }` | Broadcast when task updated |
| `task:deleted` | `{ taskId }` | Broadcast when task deleted |
| `task:assigned` | `{ taskId, task, newAssigneeId }` | Sent to assignee |
| `notification` | `{ id, type, message, taskId }` | General notifications |

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `roomName` | Join a specific room |
| `room:leave` | `roomName` | Leave a specific room |

### Example Usage

```javascript
// Listen for task updates
socket.on('task:created', (data) => {
  console.log('New task created:', data.task);
  // Update UI
});

socket.on('task:updated', (data) => {
  console.log('Task updated:', data.task);
  // Update UI
});

socket.on('task:assigned', (data) => {
  console.log('Task assigned to you:', data.task);
  // Show notification
});
```

---

## 🧪 Testing

### Run All Tests
```bash
pnpm run test
```

### Run Specific Test Suites
```bash
# Unit tests
pnpm run test:unit

# Integration tests
pnpm run test:integration

# E2E tests
pnpm run test:e2e
```

### Test Structure
```
tests/
├── unit/               # Unit tests
│   └── lib/
│       ├── environment.unit.test.ts
│       └── logger.unit.test.ts
├── integration/        # Integration tests
│   └── api/
│       └── users.integration.test.ts
└── e2e/               # End-to-end tests
    └── features/
        └── signup.e2e.test.ts
```

---

## 🚢 Deployment

### Environment Setup

Ensure production environment variables are set:
- Use strong JWT secrets
- Enable `secure` cookies (requires HTTPS)
- Set `NODE_ENV=production`

### Build
```bash
pnpm run build
```

### Start
```bash
pnpm start
```

---

## 📖 API Examples

### Register User
```bash
curl -X POST http://localhost:8000/api/v1/development/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "SecurePass123!"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/development/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### Create Task
```bash
curl -X POST http://localhost:8000/api/v1/development/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Implement authentication",
    "description": "Add JWT-based authentication",
    "dueDate": "2025-12-31T23:59:59Z",
    "priority": "HIGH",
    "status": "TODO",
    "assignedToId": "user-id-here"
  }'
```

### Get Tasks (with filters)
```bash
# Get all tasks
curl http://localhost:8000/api/v1/development/tasks -b cookies.txt

# Get tasks assigned to me
curl "http://localhost:8000/api/v1/development/tasks?assignedToMe=true" -b cookies.txt

# Get overdue tasks
curl "http://localhost:8000/api/v1/development/tasks?overdue=true" -b cookies.txt

# Filter by status and sort
curl "http://localhost:8000/api/v1/development/tasks?status=IN_PROGRESS&sortByDueDate=asc" -b cookies.txt
```

---

## 🔒 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: Separate access (15m) and refresh (7d) tokens
- **HTTP-only Cookies**: Prevents XSS attacks
- **CORS**: Configured with whitelist
- **Helmet.js**: Security headers
- **Input Validation**: class-validator on all DTOs
- **Session Management**: Refresh token rotation

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes with meaningful messages
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

MIT License

---

## 👤 Author

Amit Parmar

---

## 📞 Support

For issues or questions, please open an issue in the repository.
