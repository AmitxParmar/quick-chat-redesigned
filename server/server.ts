import { env } from "./config/env";
import { connectDB } from "./config/db";
import app, { initializeSocketHandler } from "./app";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

async function start() {
  await connectDB();

  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.clientUrl, "http://localhost:3000"],
      methods: ["GET", "POST"],
    },
  });

  // Initialize socket handler for user status management
  const socketHandler = initializeSocketHandler(io);

  // Additional socket events for conversation management
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client can optionally join a specific conversation room
    socket.on("conversation:join", (conversationId: string) => {
      if (typeof conversationId === "string" && conversationId.length > 0) {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation: ${conversationId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Expose io globally in process for controllers to access without importing socket.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).io = io;

  httpServer.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
