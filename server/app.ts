import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import authRoutes from "./routes/auth.route";
import conversationRoutes from "./routes/conversation.route";
import messageRoutes from "./routes/message.route";
import contactRoutes from "./routes/contacts.route";
<<<<<<< Updated upstream
=======
import SocketHandler from "./socket";
import { fileURLToPath } from "url";
>>>>>>> Stashed changes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use pino-pretty for more readable logs
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      singleLine: false,
    },
  },
});

const app = express();
const allowedClientUrls = [env.clientUrl, "http://localhost:3000"];
<<<<<<< Updated upstream
export type AppWithIO = typeof app & { io?: import("socket.io").Server };
=======
export type AppWithIO = typeof app & {
  io?: import("socket.io").Server;
  socketHandler?: SocketHandler;
};
>>>>>>> Stashed changes

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    origin: allowedClientUrls,
    credentials: true,
  })
);

app.use(
  pinoHttp({
    logger,
    customLogLevel: function (res, err) {
      if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500)
        return "warn";
      if ((res.statusCode && res.statusCode >= 500) || err) return "error";
      return "info";
    },
    customSuccessMessage: function (res) {
      // Use res.req if available, otherwise fallback to res.request (for compatibility)
      const req = (res as any).req || (res as any).request;
      const method = req && req.method ? req.method : "UNKNOWN_METHOD";
      const url = req && req.url ? req.url : "UNKNOWN_URL";
      const statusCode =
        typeof res.statusCode !== "undefined"
          ? res.statusCode
          : "UNKNOWN_STATUS";
      return `${method} ${url} -> ${statusCode}`;
    },
    customErrorMessage: function (error, res) {
      // error may be the error object or the response, so check for message
      const message =
        error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as any).message === "string"
          ? (error as any).message
          : "Unknown error";
      const statusCode =
        typeof res.statusCode !== "undefined"
          ? res.statusCode
          : "UNKNOWN_STATUS";
      return `request errored with status code: ${statusCode} - ${message}`;
    },
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          headers: req.headers,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    autoLogging: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/contacts", contactRoutes);

export default app;
