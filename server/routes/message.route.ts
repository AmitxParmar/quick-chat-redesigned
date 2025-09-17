import express from "express";
import {
  getMessages,
  sendMessage,
  updateMessageStatus,
  addImageMessage,
  searchMessages,
} from "../controllers/message.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = express.Router();

// All message routes require authentication
router.get("/:conversationId", authenticateToken, getMessages);
router.get("/search/:conversationId", authenticateToken, searchMessages);
router.post("/", authenticateToken, sendMessage);
router.post("/image", authenticateToken, addImageMessage);
router.put("/:messageId/status", authenticateToken, updateMessageStatus);

export default router;
