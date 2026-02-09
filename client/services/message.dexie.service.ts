import { db } from './db';
import { Message, MessageWithQueue, QueueMetadata } from '@/types';

class MessageDexieService {
    /**
     * Add or update a message in the local database
     */
    async addMessage(message: Message | MessageWithQueue) {
        return await db.messages.put(message);
    }

    /**
     * Bulk add messages (e.g. from sync or initial load)
     */
    async addMessages(messages: Message[]) {
        return await db.messages.bulkPut(messages);
    }

    /**
     * Get messages for a conversation
     */
    async getMessages(conversationId: string, limit = 50, offset = 0) {
        const messages = await db.messages
            .where('[conversationId+timestamp]')
            .between([conversationId, -Infinity], [conversationId, Infinity])
            .reverse() // Start from newest (largest timestamp)
            .offset(offset)
            .limit(limit)
            .toArray();

        // Return them in chronological order (oldest -> newest) for the UI
        return messages.reverse();
    }

    /**
     * Get most recent message for a conversation
     */
    async getLastMessage(conversationId: string) {
        return await db.messages
            .where('conversationId')
            .equals(conversationId)
            .reverse()
            .first();
    }

    /**
     * Update message status
     */
    async updateMessageStatus(id: string, status: string) {
        return await db.messages.update(id, { status: status as any });
    }

    /**
     * Mark all messages in a conversation as read for a specific recipient
     */
    async markMessagesAsRead(conversationId: string, userWaId: string) {
        return await db.messages
            .where('conversationId')
            .equals(conversationId)
            .filter(msg => msg.to === userWaId && msg.status !== 'read')
            .modify({ status: 'read' });
    }

    /**
      * Get message count for a conversation
      */
    async getMessageCount(conversationId: string) {
        return await db.messages.where('conversationId').equals(conversationId).count();
    }

    /**
     * Get pending messages for a specific user (status = 'sent')
     * Used for retrying delivery when user comes online
     */
    async getPendingMessages(userWaId: string) {
        return await db.messages
            .filter(msg => msg.to === userWaId && msg.status === 'sent')
            .toArray();
    }

    // ============================================
    // Queue Management Methods
    // ============================================

    /**
     * Get messages with pending or sending status for queue restoration
     * Used when app loads to restore pending messages to the queue
     */
    async getPendingMessagesForQueue(): Promise<MessageWithQueue[]> {
        return await db.messages
            .where('status')
            .anyOf(['pending', 'sending'])
            .toArray() as MessageWithQueue[];
    }

    /**
     * Update queue metadata for a message
     */
    async updateQueueMetadata(
        messageId: string,
        metadata: Partial<QueueMetadata>
    ): Promise<void> {
        const message = await db.messages.get(messageId) as MessageWithQueue | undefined;
        if (message) {
            await db.messages.update(messageId, {
                queueMetadata: {
                    ...message.queueMetadata,
                    ...metadata
                } as QueueMetadata
            });
        }
    }

    /**
     * Clear queue metadata when message is successfully sent
     */
    async clearQueueMetadata(messageId: string): Promise<void> {
        await db.messages.update(messageId, {
            queueMetadata: undefined
        });
    }

    /**
     * Increment retry count for a message
     */
    async incrementRetryCount(messageId: string): Promise<void> {
        const message = await db.messages.get(messageId) as MessageWithQueue | undefined;
        if (message?.queueMetadata) {
            await this.updateQueueMetadata(messageId, {
                retryCount: message.queueMetadata.retryCount + 1,
                lastAttemptTimestamp: Date.now()
            });
        }
    }
}

export const messageDexieService = new MessageDexieService();
