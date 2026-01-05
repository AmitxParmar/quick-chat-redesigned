import type {
  IAddMessageRequest,
  IAddMessageResponse,
} from "@/services/message.service";
import { getMessages, sendMessage } from "@/services/message.service";
import { Conversation, Message, MessagePage } from "@/types";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import api from "@/lib/api";

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

// Fetch messages for a specific conversation using the correct route
export function useMessages(conversationId: string) {
  const qc = useQueryClient();
  const listenerRef = useRef<
    ((payload: { message: Message; conversationId: string }) => void) | null
  >(null);
  const statusUpdateListenerRef = useRef<
    | ((payload: {
      messageId: string;
      conversationId: string;
      status: string;
      message: Message;
    }) => void)
    | null
  >(null);

  useEffect(() => {
    // Only run in browser and when a conversationId is available
    if (!conversationId) return;

    const socket = getSocket();

    console.log("[Socket] Setting up listeners for conversation:", conversationId);
    console.log("[Socket] Socket connected:", socket.connected);

    // Join the conversation room on the server
    socket.emit("conversation:join", conversationId);
    console.log("[Socket] Emitted conversation:join for:", conversationId);

    // Create a unique listener for this conversation
    const onMessageCreated = (payload: {
      message: Message;
      conversationId: string;
    }) => {
      if (!payload || payload.conversationId !== conversationId) return;

      console.log(
        "[Socket] message:created received for conversation:",
        conversationId
      );

      // Update the infinite query cache for this conversation
      qc.setQueryData(["messages", conversationId], (oldData: any) => {
        if (!oldData || !oldData.pages) {
          return {
            pages: [
              {
                messages: [payload.message],
                pagination: {
                  currentPage: 1,
                  totalPages: 1,
                  totalMessages: 1,
                  hasMore: false,
                },
              },
            ],
            pageParams: [1],
          };
        }

        // Check if message already exists to prevent duplicates
        const firstPage = oldData.pages[0];
        if (firstPage && Array.isArray(firstPage.messages)) {
          const messageExists = firstPage.messages.some(
            (msg: any) => msg._id === payload.message._id
          );
          if (messageExists) {
            console.log("Socket: Message already exists in cache, skipping");
            return oldData;
          }
        }

        // Prepend new message to the FIRST page (index 0)
        // Backend returns newest first, so page 0 contains most recent messages
        const newPages = oldData.pages.map((page: MessagePage, idx: number) => {
          if (idx === 0) {
            const oldMessages = Array.isArray(page.messages)
              ? page.messages
              : [];
            return {
              ...page,
              messages: [payload.message, ...oldMessages],
              pagination: {
                ...page.pagination,
                totalMessages: (page.pagination?.totalMessages || 0) + 1,
              },
            };
          }
          return page;
        });

        console.log("[Socket] Added new message to first page (newest messages)");

        return {
          ...oldData,
          pages: newPages,
        };
      });
    };

    // Create a listener for message status updates
    const onMessageStatusUpdated = (payload: {
      messageId: string;
      conversationId: string;
      status: string;
      message: Message;
      updatedBy?: string;
    }) => {
      if (!payload || payload.conversationId !== conversationId) {
        console.log(
          "[Socket] message:status-updated ignored - different conversation",
          { received: payload?.conversationId, expected: conversationId }
        );
        return;
      }

      console.log(
        "[Socket] message:status-updated received:",
        {
          messageId: payload.messageId,
          status: payload.status,
          updatedBy: payload.updatedBy,
          conversationId: payload.conversationId
        }
      );

      // Update the message status in the cache
      qc.setQueryData(["messages", conversationId], (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page: MessagePage) => ({
          ...page,
          messages: page.messages.map((msg: Message) => {
            if (msg._id === payload.messageId) {
              console.log(
                `[Socket] Updating message ${msg._id} status from ${msg.status} to ${payload.status}`
              );
              return { ...msg, status: payload.status };
            }
            return msg;
          }),
        }));

        return {
          ...oldData,
          pages: newPages,
        };
      });
    };

    // Store the listener references for cleanup
    listenerRef.current = onMessageCreated;
    statusUpdateListenerRef.current = onMessageStatusUpdated;

    // Add listeners to socket
    socket.on("message:created", onMessageCreated);
    socket.on("message:status-updated", onMessageStatusUpdated);

    console.log("[Socket] Listeners registered for conversation:", conversationId);

    // Cleanup function
    return () => {
      console.log("[Socket] Cleaning up listeners for conversation:", conversationId);
      if (listenerRef.current) {
        socket.off("message:created", listenerRef.current);
        listenerRef.current = null;
      }
      if (statusUpdateListenerRef.current) {
        socket.off("message:status-updated", statusUpdateListenerRef.current);
        statusUpdateListenerRef.current = null;
      }
    };
  }, [conversationId, qc]);

  return useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: async ({ pageParam = 1 }) => {
      // getMessages should accept conversationId and page params
      return getMessages(conversationId, { page: pageParam, limit: 10 });
    },
    enabled: !!conversationId,
    getNextPageParam: (lastPage) => {
      // lastPage is expected to be the IMessageResponse
      // API response: lastPage.pagination.hasMore, lastPage.pagination.currentPage, lastPage.pagination.totalPages
      if (
        lastPage?.pagination &&
        lastPage.pagination.hasMore &&
        lastPage.pagination.currentPage < lastPage.pagination.totalPages
      ) {
        return lastPage.pagination.currentPage + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    retry: 2,

    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });
}

// Send a new message and update the cache for the correct conversation

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<IAddMessageResponse, unknown, IAddMessageRequest>({
    mutationFn: (data) => {
      // Only update conversations cache - messages cache will be updated by socket
      return sendMessage(data)
    },
    onSuccess: (data, _) => {
      qc.setQueryData(
        ["conversations"],
        (oldConvo: Conversation[] | undefined) => {
          if (!oldConvo) return oldConvo;
          // Find the conversation to update
          const idx = oldConvo.findIndex(
            (convo) => convo._id === data.conversationId
          );
          if (idx === -1) return oldConvo;

          // Update the lastMessage and move the conversation to the top
          const updatedConvo = {
            ...oldConvo[idx],
            lastMessage: data.message,
          };
          return [
            updatedConvo,
            ...oldConvo.slice(0, idx),
            ...oldConvo.slice(idx + 1),
          ];
        }
      );
    },
  });
}
