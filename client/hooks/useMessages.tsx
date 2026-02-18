import {
  IAddMessageRequest,
} from "@/services/message.service";
import { Message, MessageWithQueue } from "@/types";
import { useEffect, useState, useCallback, useMemo } from "react";
import { SocketEvents } from "@/types/socket-events";
import { socketService } from "@/services/socket.service";
import { liveQuery } from "dexie";
import { messageDexieService } from "@/services/message.dexie.service";
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
        console.log('[useMessages] Network online - notifying queue service');
        messageQueueService.setNetworkStatus(true);
      };

      const handleOffline = () => {
        console.log('[useMessages] Network offline - notifying queue service');
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

  // --- Infinite Scroll Logic (Page-based LiveQuery) ---

  // Create a liveQuery observable for a specific page
  const createLiveQuery = useCallback((pageNo: number) => liveQuery(
    () => messageDexieService.getMessages(conversationId, pageSize, pageNo * pageSize)
  ), [conversationId, pageSize]);

  // Current ongoing queries (one per "page")
  // Initialize with the first page (offset 0)
  const [liveQueries, setLiveQueries] = useState(() => [createLiveQuery(0)]);

  // Current set of result sets (one result set per page)
  const [resultArrays, setResultArrays] = useState<Message[][]>([]);

  // Subscribe to all liveQueries
  useEffect(() => {
    // metadata tracking to avoid state updates if component unmounts
    let isMounted = true;

    const subscriptions = liveQueries.map((q, i) => q.subscribe(
      (results: Message[]) => {
        if (!isMounted) return;
        setResultArrays(prev => {
          const newArrays = [...prev];
          newArrays[i] = results;
          return newArrays;
        });
      },
      (error: any) => console.error(`Error in liveQuery page ${i}:`, error)
    ));

    return () => {
      isMounted = false;
      subscriptions.forEach(s => s.unsubscribe());
    };
  }, [liveQueries]); // limiting dependencies to avoid re-subscription loops

  // Re-initialize when conversationId changes
  useEffect(() => {
    setLiveQueries([createLiveQuery(0)]);
    setResultArrays([]);
  }, [conversationId, createLiveQuery]);

  const fetchNextPage = useCallback(() => {
    const nextPageNo = liveQueries.length;
    setLiveQueries(prev => [...prev, createLiveQuery(nextPageNo)]);
  }, [liveQueries.length, createLiveQuery]);

  // Flatten results for UI
  // Note: resultArrays are [Page0(Newest), Page1(Older), ...]
  // But inside each page, messages are Oldest->Newest (from service)
  // We want to display them chronologically: PageN...Page1...Page0
  // So we reverse the pages order, then flat map?
  // Wait, service returns: `messages.reverse()` (Oldest->Newest).
  // Example: 
  // Page 0 (Offset 0-50 newest): [Msg45..Msg50]
  // Page 1 (Offset 50-100 older): [Msg0..Msg5]
  // We want [Msg0..Msg5, ..., Msg45..Msg50]
  // So we need to reverse the PAGE order (Page 1 then Page 0) before flattening?
  // Yes: [...resultArrays].reverse().flat() should give [Oldest...Newest]
  const messages = useMemo(() => {
    // copying to avoid mutating state array
    return [...resultArrays].reverse().flat();
  }, [resultArrays]);

  const totalLoaded = messages.length;
  // If the last page (highest offset) returns fewer items than pageSize, we reached the end
  const hasNextPage = resultArrays.length > 0 && resultArrays[resultArrays.length - 1]?.length === pageSize;


  // --- Real-time & Socket Logic ---

  // Listen for real-time connection and messages
  useEffect(() => {
    if (!conversationId || !user?.waId) return;
    const socket = getSocket();

    socket.emit(SocketEvents.CONVERSATION_JOIN, conversationId);

    const onConnect = () => {
      console.log("Socket connected, checking for pending messages...");
      retryPendingMessages();
    };

    socket.on("connect", onConnect);

    // Initial check in case we are already connected or just loaded
    if (socket.connected) {
      retryPendingMessages();
    }

    // Also listen to online status of browser
    const onOnline = () => retryPendingMessages();
    window.addEventListener('online', onOnline);

    return () => {
      socket.off("connect", onConnect);
      window.removeEventListener('online', onOnline);
    };

    async function retryPendingMessages() {
      const pending = await messageDexieService.getPendingMessages(conversationId);
      if (pending.length > 0) {
        console.log(`Resending ${pending.length} pending messages...`);
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
    isLoading: resultArrays.length === 0 && liveQueries.length > 0 && messages.length === 0, // Initial loading
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
