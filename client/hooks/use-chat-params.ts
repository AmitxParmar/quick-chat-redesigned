import { useParams } from "next/navigation";

/**
 * A hook to extract chat-related parameters from the URL.
 * 
 * @returns {Object} An object containing the conversation parameters.
 * @property {string} conversationId - The ID of the current conversation.
 * @property {string} activeChatUserId - The ID of the active user in the chat.
 */
export const useChatParams = () => {
    const params = useParams<{ conversationId: string[] }>();

    const conversationIdArray = params.conversationId;
    const conversationId = conversationIdArray?.[0] || "";
    const activeChatUserId = conversationIdArray?.[1] || "";

    return {
        conversationId,
        activeChatUserId,
    };
};
