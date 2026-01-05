import {
  fetchAllConversations,
  markMessagesAsRead,
  getConversationId,
  deleteConversation,
} from "@/services/conversations.service";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import api from "@/lib/api";
import { Conversation } from "@/types";
import useAuth from "@/hooks/useAuth";

// Global socket singleton to prevent multiple connections
let globalSocket: Socket | null = null;

function getSocket() {
  if (!globalSocket) {
    const baseURL = api.defaults.baseURL || "http://localhost:5000";
    globalSocket = io(baseURL, {
      transports: ["websocket"],
      autoConnect: true,
      withCredentials: true,
    });
  }
  return globalSocket;
}

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

  useEffect(() => {
    // Only run in browser and when user is authenticated and available
    if (!isAuthenticated || !user?.waId) return;

    const socket = getSocket();

    // Create a unique listener for conversation updates
    const onConversationUpdated = (conversation: Conversation) => {
      console.log("Socket: conversation:updated received:", conversation._id);

      // Update the conversations cache
      qc.setQueryData(
        ["conversations", user.waId],
        (oldConvo: Conversation[] | undefined) => {
          if (!oldConvo) return oldConvo;

          // Find the conversation to update
          const idx = oldConvo.findIndex(
            (convo) => convo._id === conversation._id
          );

          if (idx === -1) {
            // If conversation doesn't exist, add it to the beginning
            return [conversation, ...oldConvo];
          }

          // Update the conversation and move it to the top
          const updatedConvo = {
            ...oldConvo[idx],
            ...conversation,
          };
          return [
            updatedConvo,
            ...oldConvo.slice(0, idx),
            ...oldConvo.slice(idx + 1),
          ];
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
      console.log("[Socket] messages:marked-as-read received:", {
        conversationId: payload.conversationId,
        waId: payload.waId,
        updatedMessages: payload.updatedMessages,
        currentUser: user.waId,
      });

      // Only update if this is for the current user
      if (payload.waId !== user.waId) {
        console.log("[Socket] messages:marked-as-read ignored - different user");
        return;
      }

      // Update the conversations cache with the updated conversation
      qc.setQueryData(
        ["conversations", user.waId],
        (oldConvo: Conversation[] | undefined) => {
          if (!oldConvo) return oldConvo;

          const idx = oldConvo.findIndex(
            (convo) => convo._id === payload.conversationId
          );

          if (idx === -1) {
            console.log("[Socket] Conversation not found in cache");
            return oldConvo;
          }

          // Update the conversation with new status
          const updatedConvo = {
            ...oldConvo[idx],
            ...payload.conversation,
          };

          console.log("[Socket] Updated conversation unreadCount:", updatedConvo.unreadCount);

          return [
            updatedConvo,
            ...oldConvo.slice(0, idx),
            ...oldConvo.slice(idx + 1),
          ];
        }
      );

      // DON'T update messages cache here to prevent triggering useEffect
      // The server response will handle the status update
    };

    // Store the listener references for cleanup
    listenerRef.current = onConversationUpdated;
    markAsReadListenerRef.current = onMessagesMarkedAsRead;

    // Add listeners to socket
    socket.on("conversation:updated", onConversationUpdated);
    socket.on("messages:marked-as-read", onMessagesMarkedAsRead);

    // Cleanup function
    return () => {
      if (listenerRef.current) {
        socket.off("conversation:updated", listenerRef.current);
        listenerRef.current = null;
      }
      if (markAsReadListenerRef.current) {
        socket.off("messages:marked-as-read", markAsReadListenerRef.current);
        markAsReadListenerRef.current = null;
      }
    };
  }, [user?.waId, isAuthenticated, qc]);

  return useQuery({
    queryKey: ["conversations", user?.waId],
    queryFn: () => fetchAllConversations(),
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
            if (convo._id === conversationId) {
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
                conv._id === conversationId
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
              return oldData.filter((conv) => conv._id !== conversationId);
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
                conv._id === conversationId
                  ? { ...conv, isArchived: true }
                  : conv
              );
            } else {
              return oldData.filter((conv) => conv._id !== conversationId);
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
