import mongoose from "mongoose";
import app from "../app";
import { Request, Response } from "express";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { User, IUser } from "../models/User";

interface AuthRequest extends Request {
  user?: IUser;
}

/**
 * Get or create a conversation ID for two participants.
 *
 * @route POST /api/conversations
 * @param {Request} req - Express request object (expects from and to in body)
 * @param {Response} res - Express response object
 * @returns {Promise<Response>}
 * @description
 *   Finds existing conversation between two participants or creates a new one.
 *   Responds with conversation ID for navigation.
 */
export const getConversationId = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const from = req.user.waId;
    const { to } = req.body;

    const normalizeWaId = (id: string) =>
      id?.startsWith("91") ? id.trim() : `91${id?.trim()}`;

    // Validate required fields
    if (!to) {
      return res.status(400).json({
        success: false,
        message: "'to' field is required",
      });
    }

    if (typeof to !== "string") {
      return res.status(400).json({
        success: false,
        message: "'to' must be a string",
      });
    }

    const fromId = normalizeWaId(from);
    const toId = normalizeWaId(to);

    if (!fromId || !toId) {
      return res.status(400).json({
        success: false,
        message: "Both 'from' and 'to' must be non-empty strings",
      });
    }

    if (fromId === toId) {
      return res.status(400).json({
        success: false,
        message: "Cannot create conversation with the same participant",
      });
    }

    // Look for existing conversation between these two participants
    const existingConversation = await Conversation.findOne({
      $and: [
        { "participants.waId": fromId },
        { "participants.waId": toId },
        { participants: { $size: 2 } },
      ],
    }).lean();

    console.log(
      `[getConversationId] from=${fromId} to=${toId} existing=${existingConversation?._id}`
    );

    if (existingConversation) {
      // Return only the conversationId and isNew, not the whole conversation object
      return res.status(200).json({
        success: true,
        data: {
          _id: existingConversation._id?.toString() || existingConversation.id,
          conversationId:
            (existingConversation as any).conversationId ||
            existingConversation._id?.toString() ||
            existingConversation.id,
          isNew: false,
        },
      });
    }

    // No existing conversation found, need to create new one
    const users = await User.find({
      waId: { $in: [fromId, toId] },
    });

    if (users.length !== 2) {
      const foundIds = users.map((u) => u.waId);
      const missingIds = [fromId, toId].filter((id) => !foundIds.includes(id));

      return res.status(404).json({
        success: false,
        message: `User(s) not found: ${missingIds.join(", ")}`,
      });
    }

    const participants = users.map((user) => ({
      waId: user.waId,
      name: user.name || `User ${user.waId}`,
      profilePicture: user.profilePicture,
    }));

    const newConversation = new Conversation({
      participants,
      unreadCount: 0,
      isArchived: false,
    });

    const savedConversation = await newConversation.save();

    console.log(
      `[getConversationId] created conversationId=${savedConversation._id
      } participants=${participants.map((p) => p.waId).join(",")}`
    );

    return res.status(201).json({
      success: true,
      data: {
        _id: savedConversation._id?.toString() || savedConversation.id,
        conversationId:
          savedConversation.conversationId ||
          savedConversation._id?.toString() ||
          savedConversation.id,
        isNew: true,
      },
    });
  } catch (error) {
    console.error("Error in getConversationId:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process conversation ID request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get all conversations for WhatsApp-like list for a specific user.
 *
 * @route GET /api/conversations/:userId
 * @param {Request} req - Express request object (expects userId in params)
 * @param {Response} res - Express response object
 * @returns {Promise<Response>}  // <-- Fixed return type
 * @description
 *   Fetches all non-archived conversations for the given user, sorted by the latest message timestamp.
 *   Responds with an array of conversation objects.
 */
export const getConversations = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Build query step by step for debugging
    const query = {
      isArchived: false,
      "participants.waId": req.user.waId, // Filter conversations where authenticated user is a participant
      $and: [
        { lastMessage: { $exists: true } },
        { "lastMessage.timestamp": { $exists: true, $ne: null } },
        { "lastMessage.text": { $exists: true, $ne: "" } },
      ],
    };

    console.log(
      `[getConversations] Query for user ${req.user.waId}:`,
      JSON.stringify(query, null, 2)
    );

    const conversations = await Conversation.find(query)
      .sort({ "lastMessage.timestamp": -1 })
      .lean();

    // Debug: Check what conversations exist for this user without filters
    const allUserConversations = await Conversation.find({
      "participants.waId": req.user.waId,
    }).lean();

    // Debug: Check for conversations with problematic lastMessage
    const problematicConversations = await Conversation.find({
      "participants.waId": req.user.waId,
      $or: [
        { lastMessage: { $exists: false } },
        { "lastMessage.text": "" },
        { "lastMessage.text": { $exists: false } },
        { "lastMessage.timestamp": { $exists: false } },
      ],
    }).lean();

    console.log(
      `[getConversations] Found ${conversations.length} conversations for user ${req.user.waId} with filters`
    );
    console.log(
      `[getConversations] Total conversations for user ${req.user.waId} without filters: ${allUserConversations.length}`
    );
    console.log(
      `[getConversations] Problematic conversations: ${problematicConversations.length}`
    );

    if (problematicConversations.length > 0) {
      console.log(
        `[getConversations] Problematic conversations:`,
        problematicConversations.map((c) => ({
          id: c._id,
          lastMessage: c.lastMessage,
          participants: c.participants.map((p) => p.waId),
        }))
      );
    }

    if (allUserConversations.length > 0) {
      console.log(
        `[getConversations] Sample conversations without filters:`,
        allUserConversations.slice(0, 3).map((c) => ({
          id: c._id,
          lastMessage: c.lastMessage,
          participants: c.participants.map((p) => p.waId),
        }))
      );
    }

    if (conversations.length > 0 && conversations[0]) {
      console.log(
        `[getConversations] First conversation lastMessage:`,
        conversations[0].lastMessage
      );
    }

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Mark all messages in a conversation as read for a specific user.
 *
 * @route POST /api/conversations/:conversationId/read
 * @param {Request} req - Express request object (expects conversationId in params, waId in body)
 * @param {Response} res - Express response object
 * @returns {Promise<Response>}
 * @description
 *   Updates all unread messages in the conversation (where to=waId and status is "sent" or "delivered") to "read".
 *   Also updates the conversation's lastMessage.status to "read" and resets unreadCount to 0.
 *   Responds with the status of the update and the lastMessage before and after the update.
 */
export const markAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { conversationId } = req.params;
    const waId = req.user.waId; // Use authenticated user's waId

    if (!mongoose.Types.ObjectId.isValid(conversationId as string)) {
      console.log("[markAsRead] Invalid conversationId:", conversationId);
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    // Update all unread messages in the conversation to 'read'
    const updateResult = await Message.updateMany(
      {
        conversationId,
        to: waId,
        status: { $in: ["sent", "delivered"] },
      },
      {
        status: "read",
      }
    );
    console.log("[markAsRead] Message.updateMany result:", updateResult);

    // Find the conversation and get the lastMessage
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      console.log("[markAsRead] Conversation not found:", conversationId);
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }
    console.log(
      "[markAsRead] Conversation.lastMessage before update:",
      conversation.lastMessage
    );

    // Find the latest message in the conversation (in case lastMessage is stale)
    const lastMsg = await Message.findOne({ conversationId })
      .sort({ timestamp: -1 })
      .lean();

    let lastMessageUpdated = false;

    if (lastMsg) {
      // If the last message is to this user and its status is not "read", update lastMessage.status
      if (lastMsg.to === waId && lastMsg.status !== "read") {
        // Update lastMessage.status in the Conversation document
        const updateConvResult = await Conversation.findByIdAndUpdate(
          conversationId,
          {
            $set: {
              "lastMessage.status": "read",
              unreadCount: 0,
            },
          },
          { new: true }
        );
        lastMessageUpdated = true;
        console.log(
          "[markAsRead] Updated Conversation.lastMessage.status to 'read'. Update result:",
          updateConvResult?.lastMessage
        );
      } else {
        // Still reset unreadCount if not already done
        if (conversation.unreadCount !== 0) {
          const updateUnreadResult = await Conversation.findByIdAndUpdate(
            conversationId,
            {
              $set: { unreadCount: 0 },
            }
          );
          console.log(
            "[markAsRead] Reset unreadCount to 0. Update result:",
            updateUnreadResult?.unreadCount
          );
        }
        console.log(
          "[markAsRead] lastMsg.to !== waId or lastMsg.status already 'read'. No lastMessage.status update."
        );
      }
    } else {
      // No messages found for this conversation
      console.log(
        "[markAsRead] No messages found for conversation:",
        conversationId
      );
      // Still reset unreadCount if not already done
      if (conversation.unreadCount !== 0) {
        const updateUnreadResult = await Conversation.findByIdAndUpdate(
          conversationId,
          {
            $set: { unreadCount: 0 },
          }
        );
        console.log(
          "[markAsRead] Reset unreadCount to 0. Update result:",
          updateUnreadResult?.unreadCount
        );
      }
    }

    // --- Always update Conversation.lastMessage.status to "read" as requested ---
    // This ensures the field is updated regardless of the above logic
    const forceUpdateConv = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          "lastMessage.status": "read",
        },
      },
      { new: true }
    );
    console.log(
      "[markAsRead] Forced Conversation.lastMessage.status to 'read'. Update result:",
      forceUpdateConv?.lastMessage
    );
    // --------------------------------------------------------------------------

    // Fetch the conversation again to see if lastMessage.status is updated
    const updatedConversation = await Conversation.findById(conversationId);
    console.log(
      "[markAsRead] Conversation.lastMessage after update:",
      updatedConversation?.lastMessage
    );

    // Get all messages that were updated to 'read' for detailed socket events
    const affectedMessages = await Message.find({
      conversationId,
      to: waId,
      status: "read", // Now they're all marked as read
    }).select('_id from to conversationId').lean();

    console.log(`[markAsRead] Found ${affectedMessages.length} messages marked as read`);

    // Emit socket events to notify clients about the status update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (app as any).io as import("socket.io").Server | undefined;
    if (io && updatedConversation) {
      const convId = updatedConversation._id?.toString() || "";

      // Emit to conversation room for targeted delivery
      io.to(convId).emit("conversation:updated", updatedConversation);

      // Emit specific bulk mark-as-read event
      io.to(convId).emit("messages:marked-as-read", {
        conversationId: convId,
        waId,
        updatedMessages: updateResult.modifiedCount,
        conversation: updatedConversation,
      });

      // Emit individual message status updates for each read message
      // This ensures senders get real-time read receipts
      affectedMessages.forEach((msg) => {
        io.to(convId).emit("message:status-updated", {
          messageId: msg._id.toString(),
          conversationId: convId,
          status: "read",
          message: msg,
          updatedBy: waId,
        });
      });

      console.log(
        `[markAsRead] Emitted socket events for conversation: ${convId}, affected messages: ${affectedMessages.length}`
      );
    }

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
      lastMessageStatusUpdated: lastMessageUpdated,
      lastMessageBefore: conversation.lastMessage,
      lastMessageAfter: updatedConversation?.lastMessage,
      affectedMessagesCount: affectedMessages.length,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark messages as read",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a conversation (soft delete by archiving or hard delete).
 *
 * @route DELETE /api/conversations/:conversationId
 * @param {Request} req - Express request object (expects conversationId in params and deleteType in query)
 * @param {Response} res - Express response object
 * @returns {Promise<Response>}
 * @description
 *   Deletes a conversation either by archiving it (soft delete) or permanently removing it (hard delete).
 *   - Soft delete: Sets isArchived to true (default behavior)
 *   - Hard delete: Permanently removes conversation and all associated messages
 *   Only the authenticated user who is a participant can delete the conversation.
 */
export const deleteConversation = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { conversationId } = req.params;
    const { deleteType = "soft" } = req.query; // "soft" (archive) or "hard" (permanent delete)
    const waId = req.user.waId;

    // Validate conversation ID
    /*    if (!mongoose.Types.ObjectId.isValid(conversationId as string)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    } */

    // Validate delete type
    if (deleteType !== "soft" && deleteType !== "hard") {
      return res.status(400).json({
        success: false,
        message: "Invalid delete type. Must be 'soft' or 'hard'",
      });
    }

    // Find the conversation and verify user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Check if user is a participant in this conversation
    const isParticipant = conversation.participants.some(
      (participant) => participant.waId === waId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this conversation",
      });
    }

    let result;
    let message: string;

    if (deleteType === "soft") {
      // Soft delete: Archive the conversation
      result = await Conversation.findByIdAndUpdate(
        conversationId,
        {
          $set: { isArchived: true },
        },
        { new: true }
      );

      message = "Conversation archived successfully";
    } else {
      // Hard delete: Permanently remove conversation and all messages

      // First, delete all messages in this conversation
      const messagesDeleted = await Message.deleteMany({ conversationId });
      console.log(
        `[deleteConversation] Deleted ${messagesDeleted.deletedCount} messages for conversation: ${conversationId}`
      );

      // Then delete the conversation itself
      result = await Conversation.findByIdAndDelete(conversationId);

      message = "Conversation and all messages deleted permanently";
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or already deleted",
      });
    }

    // Emit socket events to notify clients about the deletion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (app as any).io as import("socket.io").Server | undefined;
    if (io) {
      if (deleteType === "soft") {
        // Emit conversation updated event for soft delete
        io.emit("conversation:updated", result);
      } else {
        // Emit conversation deleted event for hard delete
        io.emit("conversation:deleted", {
          conversationId,
          waId,
          participants: conversation.participants.map((p) => p.waId),
        });
      }

      console.log(
        `[deleteConversation] Emitted socket event for ${deleteType} delete of conversation: ${conversationId}`
      );
    }

    return res.status(200).json({
      success: true,
      message,
      data: {
        conversationId,
        deleteType,
        deletedAt: new Date(),
        ...(deleteType === "soft" && { conversation: result }),
      },
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete conversation",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
