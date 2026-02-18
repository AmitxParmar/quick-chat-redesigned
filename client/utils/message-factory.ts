import { MessageWithQueue } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface CreateMessageParams {
    conversationId: string;
    text: string;
    from: string;
    to: string;
    type?: string;
}

/**
 * Creates a standard outbound message object with queue metadata.
 */
export function createOutboundMessage({
    conversationId,
    text,
    from,
    to,
    type = "text",
}: CreateMessageParams): MessageWithQueue {
    const messageId = uuidv4();
    const now = Date.now();

    return {
        id: messageId,
        conversationId,
        from,
        to,
        text,
        type: (type as any) || "text",
        timestamp: now,
        status: "pending", // Always start as pending
        waId: from,
        direction: "outgoing",
        contact: { name: "", waId: from },
        createdAt: new Date(),
        updatedAt: new Date(),
        queueMetadata: {
            retryCount: 0,
            lastAttemptTimestamp: now,
            enqueuedAt: now,
        },
    };
}
