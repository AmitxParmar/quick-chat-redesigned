import {
  IAddMessageRequest,
} from "@/services/message.service";
import { Message, MessageWithQueue } from "@/types";
import { useEffect, useState, useCallback } from "react";
import { SocketEvents } from "@/types/socket-events";
import { socketService } from "@/services/socket.service";
import { liveQuery } from "dexie";
import { messageDexieService } from "@/services/message.dexie.service";
import { handleCatchup } from "@/logic/socket-event-handlers";
import useAuth from "./useAuth";
import { createOutboundMessage } from "@/utils/message-factory";

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
 * Pagination is keyset/cursor-based (PERFORMANCE_ENGINEERING 3.5):
 * - Initial window: newest `pageSize` messages, no offset scan.
 * - "Load more" steps a lower-bound cursor down to the oldest message of
 *   the next older batch; the live query window is always `[cursor, ...]`,
 *   so new arrivals and older pages stay contiguous (no skip/duplicate
 *   windows while messages arrive).
 *
 * @param conversationId - The ID of the conversation to fetch messages for.
 * @returns An object containing messages, loading state, and pagination controls.
 */
export function useMessages(conversationId: string) {
  const [pageSize] = useState(50);
  const { user } = useAuth();

  // Initialize message queue service
  useEffect(() => {
    const initQueue = async () => {
      const { messageQueueService } = await import('@/services/message-queue.service');
      await messageQueueService.initialize();
    };
    initQueue();
  }, []);

  // Monitor network status and update queue service
  useEffect(() => {
    const updateQueueNetworkStatus = async () => {
      const { messageQueueService } = await import('@/services/message-queue.service');

      const handleOnline = () => {
        process.env.NODE_ENV === "development" && console.log('[useMessages] Network online - notifying queue service');
        messageQueueService.setNetworkStatus(true);
      };

      const handleOffline = () => {
        process.env.NODE_ENV === "development" && console.log('[useMessages] Network offline - notifying queue service');
        messageQueueService.setNetworkStatus(false);
      };

      // Set initial status
      messageQueueService.setNetworkStatus(navigator.onLine);

      // Listen for network changes
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    };

    updateQueueNetworkStatus();
  }, []);

  // --- Infinite Scroll Logic (keyset cursor) ---

  // Lower bound of the live message window. null = newest `pageSize`
  // messages only; loading older moves the bound down.
  const [cursor, setCursor] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Reset pagination synchronously during render when the conversation
  // changes — prevents a stale-cursor query against the new conversation.
  const [prevConversationId, setPrevConversationId] = useState(conversationId);
  if (prevConversationId !== conversationId) {
    setPrevConversationId(conversationId);
    setCursor(null);
    setMessages([]);
    setHasNextPage(true);
    setIsInitialLoading(true);
  }

  // Subscribe to the live window `[cursor, ∞)` (or newest page while null).
  // Re-subscribes only when the conversation or cursor changes, so live
  // inserts flow through without gaps.
  useEffect(() => {
    let isMounted = true;
    setIsInitialLoading(true);

    const query =
      cursor === null
        ? () => messageDexieService.getRecentMessages(conversationId, pageSize)
        : () => messageDexieService.getMessagesSince(conversationId, cursor);

    const subscription = liveQuery(query).subscribe(
      (results: Message[]) => {
        if (!isMounted) return;
        setMessages(results);
        setIsInitialLoading(false);
        // Initial window shorter than a page = no older history to load.
        if (cursor === null && results.length < pageSize) {
          setHasNextPage(false);
        }
      },
      (error: unknown) => console.error(`Error loading messages:`, error)
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [conversationId, cursor, pageSize]);

  const fetchNextPage = useCallback(async () => {
    if (messages.length === 0) return;
    const oldestTs = messages[0].timestamp;

    // One-shot keyset step: is there anything below the current window?
    const hasOlder = await messageDexieService.hasMessagesBefore(conversationId, oldestTs);
    if (!hasOlder) {
      setHasNextPage(false);
      return;
    }

    // Fetch the next older batch only to find the new lower bound, then
    // let the live query re-subscribe to the widened window.
    const older = await messageDexieService.getMessagesBefore(conversationId, oldestTs, pageSize);
    if (older.length === 0) {
      setHasNextPage(false);
      return;
    }
    setCursor(older[0].timestamp);
  }, [messages, conversationId, pageSize]);

  // --- Real-time & Socket Logic ---

  // Listen for real-time connection and messages
  useEffect(() => {
    if (!conversationId || !user?.waId) return;
    const socket = getSocket();

    socket.emit(SocketEvents.CONVERSATION_JOIN, conversationId);

    const onConnect = () => {
      process.env.NODE_ENV === "development" && console.log("Socket connected, checking for pending messages...");
      // Re-join: server-side rooms are lost on every reconnect, so
      // status/read-receipt events addressed to the conversation room
      // would silently stop until remount without this.
      socket.emit(SocketEvents.CONVERSATION_JOIN, conversationId);
      retryPendingMessages();
      requestCatchup();
    };

    // Catch-up replies land here (server: conversation:sync handler).
    // bulkPut is idempotent, so overlaps with live traffic are safe.
    const onCatchup = (payload: { conversationId: string; messages: Message[] }) => {
      if (payload?.conversationId !== conversationId) return;
      handleCatchup(payload);
    };

    socket.on("connect", onConnect);
    socket.on(SocketEvents.CONVERSATION_CATCHUP, onCatchup);

    // Initial check in case we are already connected or just loaded
    if (socket.connected) {
      retryPendingMessages();
      requestCatchup();
    }

    // Also listen to online status of browser
    const onOnline = () => retryPendingMessages();
    window.addEventListener('online', onOnline);

    return () => {
      socket.off("connect", onConnect);
      socket.off(SocketEvents.CONVERSATION_CATCHUP, onCatchup);
      window.removeEventListener('online', onOnline);
    };

    // Ask the server for everything missed since our newest stored
    // message (PERFORMANCE_ENGINEERING 1.3). Keyset, not offsets.
    async function requestCatchup() {
      try {
        const last = await messageDexieService.getLastMessage(conversationId);
        socket.emit(SocketEvents.CONVERSATION_SYNC, {
          conversationId,
          since: last?.timestamp ?? 0,
        });
      } catch (e) {
        console.error("Catch-up request failed:", e);
      }
    }

    async function retryPendingMessages() {
      const pending = await messageDexieService.getPendingMessages(conversationId);
      if (pending.length > 0) {
        process.env.NODE_ENV === "development" && console.log(`Resending ${pending.length} pending messages...`);
        pending.forEach(msg => {
          // Re-emit message:send
          socket.emit(SocketEvents.MESSAGE_SEND, msg);
        });
      }
    }
  }, [conversationId, user?.waId]);

  // Mark as read logic (kept similar to before)
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0 || !user?.waId) return;

    const unreadMessages = messages.filter(
      m => m.to === user.waId && m.status !== 'read'
    );

    if (unreadMessages.length > 0) {
      // Update local status immediately
      const socket = getSocket();
      unreadMessages.forEach(msg => {
        messageDexieService.updateMessageStatus(msg.id, 'read');
      });

      socket.emit(SocketEvents.MESSAGES_MARKED_AS_READ, {
        conversationId,
        waId: user.waId,
        updatedMessages: unreadMessages.length
      });
    }
  }, [conversationId, messages, user?.waId]);

  return {
    messages,
    isLoading: isInitialLoading && messages.length === 0, // Initial loading
    fetchNextPage,
    hasNextPage,
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
  const sendMessage = useCallback(async (data: IAddMessageRequest, options?: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
    try {
      if (!user?.waId) throw new Error("User not authenticated");

      const conversationId = data.conversationId || "";

      if (!conversationId) {
        console.warn("Message sending requires conversationId");
        return;
      }

      const newMessage: MessageWithQueue = createOutboundMessage({
        conversationId,
        text: data.text,
        from: user.waId,
        to: data.to,
        type: data.type,
      });

      // 1. Save to Dexie immediately with queue metadata
      await messageDexieService.addMessage(newMessage);

      // 2. Enqueue for processing (will handle online/offline automatically)
      const { messageQueueService } = await import('@/services/message-queue.service');
      await messageQueueService.enqueueMessage(newMessage);

      options?.onSuccess?.();
    } catch (err) {
      console.error(err);
      options?.onError?.(err);
    }
  }, [user?.waId]);

  return { mutate: sendMessage };
}
