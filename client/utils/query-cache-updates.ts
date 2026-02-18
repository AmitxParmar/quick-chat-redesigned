import { Conversation } from "@/types";
import { InfiniteData, QueryClient } from "@tanstack/react-query";

/**
 * Updates the conversation cache when a conversation is updated or added.
 * Moves the conversation to the top of the list.
 */
export function updateConversationCache(
    queryClient: QueryClient,
    waId: string,
    conversation: Conversation
) {
    queryClient.setQueryData<InfiniteData<{ conversations: Conversation[]; nextCursor: string | null }>>(
        ["conversations", waId],
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
                newPages.push({ conversations: [conversation], nextCursor: null });
            }

            return {
                ...oldData,
                pages: newPages,
            };
        }
    );
}

/**
 * Updates the conversation cache when messages are marked as read.
 */
export function markConversationAsReadInCache(
    queryClient: QueryClient,
    waId: string,
    payload: {
        conversationId: string;
        conversation: Conversation;
    }
) {
    queryClient.setQueryData<InfiniteData<{ conversations: Conversation[]; nextCursor: string | null }>>(
        ["conversations", waId],
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
}

/**
 * Updates the conversation cache when a new message is received.
 * Updates the last message and unread count, and moves the conversation to the top.
 */
export function updateConversationOnNewMessage(
    queryClient: QueryClient,
    waId: string,
    payload: { message: any; conversationId: string }
) {
    queryClient.setQueryData<InfiniteData<{ conversations: Conversation[]; nextCursor: string | null }>>(
        ["conversations", waId],
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
            if (conversationToUpdate) {
                const updatedConversation: Conversation = {
                    ...conversationToUpdate,
                    lastMessage: {
                        text: message.text,
                        timestamp: message.timestamp,
                        from: message.from,
                        status: message.status,
                    },
                    updatedAt: new Date().toISOString(),
                    // Increment unread count if message is NOT from us
                    unreadCount: message.from !== waId
                        ? (conversationToUpdate.unreadCount || 0) + 1
                        : conversationToUpdate.unreadCount
                };

                if (newPages.length > 0) {
                    newPages[0].conversations.unshift(updatedConversation);
                } else {
                    newPages.push({ conversations: [updatedConversation], nextCursor: null });
                }
            }

            return {
                ...oldData,
                pages: newPages,
            };
        }
    );
}

/**
 * Updates the conversation cache when a conversation is deleted (soft or hard).
 */
export function removeConversationFromCache(
    queryClient: QueryClient,
    waId: string,
    conversationId: string,
    deleteType: "soft" | "hard"
) {
    // Global cache
    queryClient.setQueryData(
        ["conversations"],
        (oldData: Conversation[] | undefined) => {
            if (!oldData) return oldData;
            if (deleteType === "soft") {
                return oldData.map((conv) =>
                    conv.id === conversationId
                        ? { ...conv, isArchived: true }
                        : conv
                );
            }
            return oldData.filter((conv) => conv.id !== conversationId);
        }
    );

    // User specific cache
    queryClient.setQueryData(
        ["conversations", waId],
        (oldData: Conversation[] | undefined) => {
            if (!oldData) return oldData;
            if (deleteType === "soft") {
                return oldData.map((conv) =>
                    conv.id === conversationId
                        ? { ...conv, isArchived: true }
                        : conv
                );
            }
            return oldData.filter((conv) => conv.id !== conversationId);
        }
    );
}

/**
 * Updates the messages cache to mark messages as read.
 */
export function markMessagesAsReadInCache(
    queryClient: QueryClient,
    conversationId: string,
    waId: string
) {
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
}

/**
 * Resets the unread count for a conversation in the cache.
 */
export function resetConversationUnreadCountInCache(
    queryClient: QueryClient,
    conversationId: string,
    waId: string
) {
    queryClient.setQueryData(
        ["conversations", waId],
        (oldConvo: Conversation[] | undefined) => {
            if (!oldConvo) return oldConvo;

            return oldConvo.map((convo) => {
                if (convo.id === conversationId) {
                    return {
                        ...convo,
                        unreadCount: 0,
                    };
                }
                return convo;
            });
        }
    );
}
