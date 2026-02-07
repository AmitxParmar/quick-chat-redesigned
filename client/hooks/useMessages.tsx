import {
  IAddMessageRequest,
} from "@/services/message.service";
import { Message } from "@/types";
import { useEffect, useState, useCallback } from "react";
import { SocketEvents } from "@/types/socket-events";
import { socketService } from "@/services/socket.service";
import { useLiveQuery } from "dexie-react-hooks";
import { messageDexieService } from "@/services/message.dexie.service";
import { v4 as uuidv4 } from "uuid";
import useAuth from "./useAuth";

/**
 * Retrieves the current socket instance from the socket service.
 * @returns The socket instance.
 */
// Global socket (via service)
const getSocket = () => socketService.getSocket();

/**
 * Hook to manage and observe messages for a specific conversation.
 * Uses Dexie for local persistence and real-time updates via sockets.
 * 
 * @param conversationId - The ID of the conversation to fetch messages for.
 * @returns An object containing messages, loading state, and pagination controls.
 */
export function useMessages(conversationId: string) {
  const [limit, setLimit] = useState(50);
  const { user } = useAuth(); // Get user from auth hook

  // Use Dexie live query to observe messages
  const messages = useLiveQuery(
    () => messageDexieService.getMessages(conversationId, limit),
    [conversationId, limit]
  );

  const totalMessages = useLiveQuery(
    () => messageDexieService.getMessageCount(conversationId),
    [conversationId]
  );

  // Listen for real-time messages and save to Dexie
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();

    // GlobalSocketListener handles saving incoming messages to Dexie
    // usageMessages just observes Dexie via useLiveQuery

    socket.emit(SocketEvents.CONVERSATION_JOIN, conversationId);

    return () => {
      // socket.off(SocketEvents.MESSAGE_CREATED, onMessageCreated);
    };
  }, [conversationId]);


  // Mark messages as read when they are loaded and we are looking at them
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0 || !user?.waId) return;

    // Find unread messages from other users
    const unreadMessages = messages.filter(
      m => m.to === user.waId && m.status !== 'read'
    );

    if (unreadMessages.length > 0) {
      // Update local status immediately
      const socket = getSocket();
      unreadMessages.forEach(msg => {
        messageDexieService.updateMessageStatus(msg.id, 'read');
      });

      // Notify server that we read these messages
      socket.emit(SocketEvents.MESSAGES_MARKED_AS_READ, {
        conversationId,
        waId: user.waId,
        updatedMessages: unreadMessages.length
      });
    }
  }, [conversationId, messages, user?.waId]);

  // Return flat messages array directly
  const fetchNextPage = () => {
    setLimit((prev) => prev + 50);
  };

  return {
    messages: messages || [],
    isLoading: !messages,
    fetchNextPage,
    hasNextPage: (messages?.length || 0) < (totalMessages || 0),
  };
}

/**
 * Hook to provide a function for sending messages.
 * Handles local storage in Dexie and real-time emission via sockets.
 * 
 * @returns An object containing the mutate function to send messages.
 */
export function useSendMessage() {
  const { user } = useAuth();

  /**
   * Sends a message to a recipient.
   * 
   * @param data - The message data to be sent.
   * @param options - Optional callbacks for success and error handling.
   * @param options.onSuccess - Callback triggered on successful message send.
   * @param options.onError - Callback triggered on message send failure.
   */
  const sendMessage = useCallback(async (data: IAddMessageRequest, options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
    try {
      if (!user?.waId) throw new Error("User not authenticated");

      const socket = getSocket();
      const messageId = uuidv4();
      const conversationId = data.conversationId || ""; // You might need a way to ensure conversationId exists

      if (!conversationId) {
        console.warn("Message sending requires conversationId");
        return;
      }

      const newMessage: Message = {
        id: messageId,
        conversationId,
        from: user.waId,
        to: data.to,
        text: data.text,
        type: (data.type as any) || "text",
        timestamp: Date.now(),
        status: "sent",
        waId: user.waId,
        direction: "outgoing",
        contact: { name: "", waId: user.waId },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 1. Save to Dexie immediately
      await messageDexieService.addMessage(newMessage);

      // 2. Emit to Socket
      socket.emit(SocketEvents.MESSAGE_SEND, {
        message: newMessage,
        conversationId: conversationId
      });

      options?.onSuccess?.();
    } catch (err) {
      console.error(err);
      options?.onError?.(err);
    }
  }, [user?.waId]);

  return { mutate: sendMessage };
}
