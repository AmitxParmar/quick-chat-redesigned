import {
  fetchAllConversations,
  markMessagesAsRead,
  getConversationId,
  deleteConversation,
} from "@/services/conversations.service";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import api from "@/lib/api";
import { Conversation, Message } from "@/types";
import useAuth from "@/hooks/useAuth";
import { SocketEvents } from "@/types/socket-events";

import { socketService } from "@/services/socket.service";

import {
  updateConversationCache,
  markConversationAsReadInCache,
  updateConversationOnNewMessage,
  removeConversationFromCache,
  markMessagesAsReadInCache,
  resetConversationUnreadCountInCache,
} from "@/utils/query-cache-updates";

// Global socket (via service)
const getSocket = () => socketService.getSocket();

// Fetch all conversations, cache for 1 minute, do not refetch if cached
export function useConversations() {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const listenerRef = useRef<((conversation: Conversation) => void) | null>(
    null
  );
  const markAsReadListenerRef = useRef<
    | ((payload: {
      conversationId: string;
      waId: string;
      updatedMessages: number;
      conversation: Conversation;
    }) => void)
    | null
  >(null);
  const messageCreatedListenerRef = useRef<
    ((payload: { message: Message; conversationId: string }) => void) | null
  >(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only run in browser and when user is authenticated and available
    if (!isAuthenticated || !user?.waId) return;

    const socket = getSocket();

    // Create a unique listener for conversation updates
    const onConversationUpdated = (conversation: Conversation) => {
      // Update the infinite query data
      updateConversationCache(qc, user.waId, conversation);
    };

    // Create a listener for messages marked as read
    const onMessagesMarkedAsRead = (payload: {
      conversationId: string;
      waId: string;
      updatedMessages: number;
      conversation: Conversation;
    }) => {

      // Only update if this is for the current user
      if (payload.waId !== user.waId) {
        return;
      }

      // Update the conversations cache with the updated conversation
      markConversationAsReadInCache(qc, user.waId, payload);
    };

    // Create a listener for new messages to update conversation list
    const onMessageReceived = (payload: { message: any; conversationId: string }) => {
      const { message } = payload;
      if (processedMessageIdsRef.current.has(message.id)) {
        return;
      }
      processedMessageIdsRef.current.add(message.id);
      setTimeout(() => {
        processedMessageIdsRef.current.delete(message.id);
      }, 5000);


      updateConversationOnNewMessage(qc, user.waId, payload);
    };

    // Store the listener references for cleanup
    listenerRef.current = onConversationUpdated;
    markAsReadListenerRef.current = onMessagesMarkedAsRead;
    messageCreatedListenerRef.current = onMessageReceived;

    // Add listeners to socket
    socket.on(SocketEvents.CONVERSATION_UPDATED, onConversationUpdated);
    socket.on(SocketEvents.MESSAGES_MARKED_AS_READ, onMessagesMarkedAsRead);
    socket.on(SocketEvents.MESSAGE_CREATED, onMessageReceived);

    // Cleanup function
    return () => {
      if (listenerRef.current) {
        socket.off(SocketEvents.CONVERSATION_UPDATED, listenerRef.current);
        listenerRef.current = null;
      }
      if (markAsReadListenerRef.current) {
        socket.off(SocketEvents.MESSAGES_MARKED_AS_READ, markAsReadListenerRef.current);
        markAsReadListenerRef.current = null;
      }
      if (messageCreatedListenerRef.current) {
        socket.off(SocketEvents.MESSAGE_CREATED, messageCreatedListenerRef.current);
        messageCreatedListenerRef.current = null;
      }
    };
  }, [user?.waId, isAuthenticated, qc]);

  return useInfiniteQuery({
    queryKey: ["conversations", user?.waId],
    queryFn: ({ pageParam }) => fetchAllConversations(20, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: 2,

    enabled: !!isAuthenticated && !!user?.waId, // Only run when authenticated and user exists
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

// Hook to mark all messages as read in a conversation
export function useMarkAsRead(id: string) {
  const queryClient = useQueryClient();

  // Prevent infinite calls by using a ref to track in-flight mutations per conversationId+waId
  const inFlightRef = useRef<{ [key: string]: boolean }>({});

  const mutation = useMutation<
    void,
    unknown,
    { conversationId: string; waId: string }
  >({
    mutationKey: ["mark-as-read", id],
    mutationFn: async ({
      conversationId,
      waId,
    }: {
      conversationId: string;
      waId: string;
    }) => {
      const key = `${conversationId}:${waId}`;
      if (inFlightRef.current[key]) {
        // Already in flight, don't call again
        return;
      }
      inFlightRef.current[key] = true;
      await markMessagesAsRead(conversationId, waId);
    },
    onSuccess: (_, { conversationId, waId }) => {
      // Update the messages cache directly instead of invalidating to prevent refetch
      markMessagesAsReadInCache(queryClient, conversationId, waId);

      // Update conversations cache to reflect unread count changes
      resetConversationUnreadCountInCache(queryClient, conversationId, waId);
    },
    onSettled: (_, __, variables) => {
      // Clear in-flight flag
      if (variables) {
        const { conversationId, waId } = variables;
        const key = `${conversationId}:${waId}`;
        inFlightRef.current[key] = false;
      }
    },
  });

  // Wrap mutate to prevent infinite calls for the same conversationId+waId
  const safeMutate = useCallback(
    (
      variables: { conversationId: string; waId: string },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => {
      const key = `${variables.conversationId}:${variables.waId}`;
      if (inFlightRef.current[key]) {
        // Already in flight, don't call again
        return;
      }
      mutation.mutate(variables, options);
    },
    [mutation]
  );

  return {
    ...mutation,
    mutate: safeMutate,
  };
}

// Hook to automatically mark messages as read when conversation is opened
export function useAutoMarkAsRead() {
  const { user } = useAuth();
  const markAsReadMutation = useMarkAsRead("auto");
  const isMarkingRef = useRef(false);
  const lastMarkedRef = useRef<{
    conversationId: string;
    timestamp: number;
  } | null>(null);

  const markConversationAsRead = useCallback(
    (conversationId: string) => {
      if (!user?.waId || isMarkingRef.current) return;

      // Prevent marking the same conversation within 5 seconds
      const now = Date.now();
      if (
        lastMarkedRef.current?.conversationId === conversationId &&
        now - lastMarkedRef.current.timestamp < 5000
      ) {
        return;
      }

      // Prevent if already marked as read (mutation is in progress)
      if (markAsReadMutation.isPending) return;

      // Prevent if unreadCount is already 0 (optional, but safer)
      // (You may want to pass unreadCount as an argument for more robust logic.)

      console.log(
        "Auto marking messages as read for conversation:",
        conversationId
      );

      isMarkingRef.current = true;
      lastMarkedRef.current = { conversationId, timestamp: now };

      markAsReadMutation.mutate(
        {
          conversationId,
          waId: user.waId,
        },
        {
          onSettled: () => {
            isMarkingRef.current = false;
          },
        }
      );
    },
    [user?.waId, markAsReadMutation]
  );

  return { markConversationAsRead, isLoading: markAsReadMutation.isPending };
}

// Returns a mutation to get or create a conversation ID between two users
export function useGetConversationId() {
  return useMutation({
    mutationKey: ["get-conversation-id"],
    mutationFn: getConversationId,
  });
}

// Hook to delete a conversation
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      deleteType = "soft",
    }: {
      conversationId: string;
      deleteType?: "soft" | "hard";
    }) => deleteConversation(conversationId, deleteType),
    onSuccess: (data, { conversationId, deleteType }) => {
      if (data.success) {
        removeConversationFromCache(queryClient, data.data.waId, conversationId, deleteType || "soft");

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({
          queryKey: ["messages", conversationId],
        });
      }
    },
  });
}
