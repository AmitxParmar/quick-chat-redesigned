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
import { Conversation } from "@/types";
import useAuth from "@/hooks/useAuth";
import { SocketEvents } from "@/types/socket-events";

import { socketService } from "@/services/socket.service";

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
    ((payload: { message: any; conversationId: string }) => void) | null
  >(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only run in browser and when user is authenticated and available
    if (!isAuthenticated || !user?.waId) return;

    const socket = getSocket();

    // Create a unique listener for conversation updates
    const onConversationUpdated = (conversation: Conversation) => {
      console.log("Socket: conversation:updated received:", conversation.id);

      // Update the infinite query data
      qc.setQueryData<InfiniteData<{ conversations: Conversation[]; nextCursor: string | null }>>(
        ["conversations", user.waId],
        (oldData) => {
          if (!oldData) return oldData;

          // 1. Remove conversation if it exists in any page
          const newPages = oldData.pages.map((page) => ({
            ...page,
            conversations: page.conversations.filter((c) => c.id !== conversation.id),
          }));

          // 2. Add the updated/new conversation to the top of the first page
          if (newPages.length > 0) {
            newPages[0].conversations.unshift(conversation);
          } else {
            // Should not happen if data exists, but purely defensive
            newPages.push({ conversations: [conversation], nextCursor: null });
          }

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );
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
        console.log("[Socket] messages:marked-as-read ignored - different user");
        return;
      }

      // Update the conversations cache with the updated conversation
      qc.setQueryData<InfiniteData<{ conversations: Conversation[]; nextCursor: string | null }>>(
        ["conversations", user.waId],
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              conversations: page.conversations.map((convo) => {
                if (convo.id === payload.conversationId) {
                  return {
                    ...convo,
                    ...payload.conversation,
                    unreadCount: payload.conversation.unreadCount
                  };
                }
                return convo;
              }),
            })),
          };
        }
      );
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

      console.log("[Socket] message:created received in useConversations:", payload.conversationId);

      qc.setQueryData<InfiniteData<{ conversations: Conversation[]; nextCursor: string | null }>>(
        ["conversations", user.waId],
        (oldData) => {
          if (!oldData) return oldData;

          const { message, conversationId } = payload;
          let conversationToUpdate: Conversation | undefined;

          // 1. Find and remove conversation if it exists
          const newPages = oldData.pages.map((page) => {
            const found = page.conversations.find((c) => c.id === conversationId);
            if (found) {
              conversationToUpdate = found;
              return {
                ...page,
                conversations: page.conversations.filter((c) => c.id !== conversationId),
              };
            }
            return page;
          });

          // 2. If we found it, update it and add to top.
          // If NOT found, we ideally should fetch it, but for now we only update if existing.
          if (conversationToUpdate) {
            const updatedConversation = {
              ...conversationToUpdate,
              lastMessage: {
                text: message.text,
                timestamp: message.timestamp,
                from: message.from,
                status: message.status,
              },
              updatedAt: new Date().toISOString(),
              // Increment unread count if message is NOT from us
              unreadCount: message.from !== user.waId
                ? (conversationToUpdate.unreadCount || 0) + 1
                : conversationToUpdate.unreadCount
            };

            if (newPages.length > 0) {
              newPages[0].conversations.unshift(updatedConversation as Conversation);
            } else {
              newPages.push({ conversations: [updatedConversation as Conversation], nextCursor: null });
            }
          }

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );
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
      queryClient.setQueryData(["messages", conversationId], (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page: any) => ({
          ...page,
          messages: page.messages.map((msg: any) => {
            if (msg.to === waId && msg.status !== "read") {
              return { ...msg, status: "read" };
            }
            return msg;
          }),
        }));

        return {
          ...oldData,
          pages: newPages,
        };
      });

      // Update conversations cache to reflect unread count changes
      queryClient.setQueryData(
        ["conversations", waId],
        (oldConvo: Conversation[] | undefined) => {
          if (!oldConvo) return oldConvo;

          return oldConvo.map((convo) => {
            if (convo.id === conversationId) {
              return {
                ...convo,
                unreadCount: 0, // Reset unread count
              };
            }
            return convo;
          });
        }
      );
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
        if (deleteType === "soft") {
          // For soft delete, update the conversation in cache
          queryClient.setQueryData(
            ["conversations"],
            (oldData: Conversation[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((conv) =>
                conv.id === conversationId
                  ? { ...conv, isArchived: true }
                  : conv
              );
            }
          );
        } else {
          // For hard delete, remove the conversation from cache
          queryClient.setQueryData(
            ["conversations"],
            (oldData: Conversation[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.filter((conv) => conv.id !== conversationId);
            }
          );
        }

        // Also remove from conversations cache for specific user
        queryClient.setQueryData(
          ["conversations", data.data.waId],
          (oldData: Conversation[] | undefined) => {
            if (!oldData) return oldData;
            if (deleteType === "soft") {
              return oldData.map((conv) =>
                conv.id === conversationId
                  ? { ...conv, isArchived: true }
                  : conv
              );
            } else {
              return oldData.filter((conv) => conv.id !== conversationId);
            }
          }
        );

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({
          queryKey: ["messages", conversationId],
        });
      }
    },
  });
}
