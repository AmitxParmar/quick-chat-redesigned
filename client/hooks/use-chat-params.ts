import { useParams } from "next/navigation";

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
