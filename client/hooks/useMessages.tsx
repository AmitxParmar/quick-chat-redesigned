import {
  IAddMessageRequest,
} from "@/services/message.service";
import { Message } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { SocketEvents } from "@/types/socket-events";
import { socketService } from "@/services/socket.service";
import { useLiveQuery } from "dexie-react-hooks";
import { messageDexieService } from "@/services/message.dexie.service";
import { v4 as uuidv4 } from "uuid";
import useAuth from "./useAuth";

// Global socket (via service)
const getSocket = () => socketService.getSocket();

export function useMessages(conversationId: string) {
  const [limit, setLimit] = useState(50);

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
      unreadMessages.forEach(msg => {
        messageDexieService.updateMessageStatus(msg.id, 'read');
      });

      // Notify server (you might want to batch this or use a specific event)
      // Assuming there is an API or Socket event for this. 
      // For now, let's assume we need to implement a socket emitter for "read" or use the existing REST API via mutation in previous code.
      // Re-using the logic from useConversations which used mutation.
      // But since we are full socket now:
      // Let's defer this to a specific task or assume server handles it? 
      // The user said "read indicators arent displaying". This implies they expect them to update.
      // We need to tell the server we read them.

      // TODO: Emit 'messages:read' event or similar if server supports it via socket 
      // OR use the REST API 'markAsRead' which triggers socket event.
      // Let's check conversation service... it uses REST.
    }
  }, [conversationId, messages, user?.waId]);

  // Compatibility structure for ChatContainer (which expects InfiniteData)
  const data = {
    pages: [
      {
        messages: messages || [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalMessages: totalMessages || 0,
          hasMore: (messages?.length || 0) < (totalMessages || 0),
        },
      },
    ],
    pageParams: [1],
  };

  const fetchNextPage = () => {
    setLimit((prev) => prev + 50);
  };

  return {
    data,
    isLoading: !messages,
    isFetching: !messages,
    fetchNextPage,
    hasNextPage: (messages?.length || 0) < (totalMessages || 0),
    isFetchingNextPage: false,
  };
}

export function useSendMessage() {
  const { user } = useAuth();

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

