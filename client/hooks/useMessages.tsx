import type {
  IAddMessageRequest,
  IAddMessageResponse,
  IAddImageMessageRequest,
  IUpdateMessageStatusRequest,
  ISearchMessagesRequest,
  ISearchMessagesResponse,
} from "@/services/message.service";
import {
  getMessages,
  sendMessage,
  searchMessages,
  addImageMessage,
  updateMessageStatus,
} from "@/services/message.service";
import { Conversation, Message, MessagePage } from "@/types";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
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
    ((payload: { message: any; conversationId: string }) => void) | null
  >(null);
  const statusUpdateListenerRef = useRef<
    | ((payload: {
        messageId: string;
        conversationId: string;
        status: string;
        message: any;
      }) => void)
    | null
  >(null);

  useEffect(() => {
    // Only run in browser and when a conversationId is available
    if (!conversationId) return;

    const socket = getSocket();

    // Join the conversation room on the server
    socket.emit("conversation:join", conversationId);

    // Create a unique listener for this conversation
    const onMessageCreated = (payload: {
      message: Message;
      conversationId: string;
    }) => {
      if (!payload || payload.conversationId !== conversationId) return;

      console.log(
        "Socket: message:created received for conversation:",
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
    }) => {
      if (!payload || payload.conversationId !== conversationId) return;

      console.log(
        "Socket: message:status-updated received for message:",
        payload.messageId,
        "status:",
        payload.status
      );

      // Update the message status in the cache
      qc.setQueryData(["messages", conversationId], (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page: MessagePage) => ({
          ...page,
          messages: page.messages.map((msg: Message) => {
            if (msg._id === payload.messageId) {
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

    // Cleanup function
    return () => {
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
    retry: 3,

    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });
}

// Send a new message and update the cache for the correct conversation
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<IAddMessageResponse, unknown, IAddMessageRequest>({
    mutationFn: (data) => sendMessage(data),
    onSuccess: (data, _) => {
      // Only update conversations cache - messages cache will be updated by socket
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

// Send an image message
export function useSendImageMessage() {
  const qc = useQueryClient();
  return useMutation<IAddMessageResponse, unknown, IAddImageMessageRequest>({
    mutationFn: (data) => addImageMessage(data),
    onSuccess: (data, _) => {
      // Update conversations cache - messages cache will be updated by socket
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

// Update message status
export function useUpdateMessageStatus() {
  const qc = useQueryClient();
  return useMutation<
    Message,
    unknown,
    { messageId: string; data: IUpdateMessageStatusRequest }
  >({
    mutationFn: ({ messageId, data }) => updateMessageStatus(messageId, data),
    onSuccess: (updatedMessage) => {
      // Update all message caches that might contain this message
      qc.setQueriesData({ queryKey: ["messages"] }, (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;

        const newPages = oldData.pages.map((page: MessagePage) => ({
          ...page,
          messages: page.messages.map((msg: Message) => {
            if (msg._id === updatedMessage._id) {
              return updatedMessage;
            }
            return msg;
          }),
        }));

        return {
          ...oldData,
          pages: newPages,
        };
      });
    },
  });
}

// Search messages with debouncing
export function useSearchMessages(
  conversationId: string,
  initialQuery?: string
) {
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || "");
  const [query, setQuery] = useState(initialQuery || "");

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const searchQuery = useInfiniteQuery({
    queryKey: ["searchMessages", conversationId, debouncedQuery],
    queryFn: async ({ pageParam = 1 }) => {
      if (!debouncedQuery.trim()) {
        return {
          messages: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalMessages: 0,
            hasMore: false,
          },
        };
      }
      return searchMessages(conversationId, {
        query: debouncedQuery,
        page: pageParam,
        limit: 10,
      });
    },
    enabled: !!conversationId && !!debouncedQuery.trim(),
    getNextPageParam: (lastPage) => {
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
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    ...searchQuery,
    query,
    debouncedQuery,
    updateQuery,
    clearSearch,
    isSearching: query !== debouncedQuery,
  };
}
