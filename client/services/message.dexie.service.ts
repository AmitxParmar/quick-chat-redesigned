
import { getDb } from './db';
import { Message, MessageWithQueue, QueueMetadata } from '@/types';

class MessageDexieService {
    /**
     * Add or update a message in the local database
     */
    async addMessage(message: Message | MessageWithQueue) {
        return await getDb().messages.put(message);
    }

    /**
     * Bulk add messages (e.g. from sync or initial load)
     */
    async addMessages(messages: Message[]) {
        return await getDb().messages.bulkPut(messages);
    }

    /**
     * Newest `limit` messages for a conversation (initial window).
     * Uses the compound index — no offset scan.
     */
    async getRecentMessages(conversationId: string, limit = 50) {
        const messages = await getDb().messages
            .where('[conversationId+timestamp]')
            .between([conversationId, -Infinity], [conversationId, Infinity])
            .reverse() // Start from newest (largest timestamp)
            .limit(limit)
            .toArray();

        // Return them in chronological order (oldest -> newest) for the UI
        return messages.reverse();
    }

    /**
     * Live window: all messages with timestamp >= `since`, chronological.
     * The window lower bound only ever moves down when loading older pages,
     * so new arrivals and previously loaded messages stay contiguous.
     */
    async getMessagesSince(conversationId: string, since: number) {
        return await getDb().messages
            .where('[conversationId+timestamp]')
            .between([conversationId, since], [conversationId, Infinity], true, true)
            .toArray();
    }

    /**
     * Keyset "load older" step: newest `limit` messages strictly before
     * `before`, chronological. Returns [] when history is exhausted.
     */
    async getMessagesBefore(conversationId: string, before: number, limit = 50) {
        const messages = await getDb().messages
            .where('[conversationId+timestamp]')
            .between([conversationId, -Infinity], [conversationId, before], true, false)
            .reverse()
            .limit(limit)
            .toArray();

        return messages.reverse();
    }

    /**
     * Whether any message exists strictly before `before` (drives hasNextPage).
     */
    async hasMessagesBefore(conversationId: string, before: number): Promise<boolean> {
        const row = await getDb().messages
            .where('[conversationId+timestamp]')
            .between([conversationId, -Infinity], [conversationId, before], true, false)
            .limit(1)
            .toArray();
        return row.length > 0;
    }

    /**
     * Get most recent message for a conversation
     */
    async getLastMessage(conversationId: string) {
        return await getDb().messages
            .where('conversationId')
            .equals(conversationId)
            .reverse()
            .first();
    }

    /**
     * Update message status
     */
    async updateMessageStatus(id: string, status: string) {
        return await getDb().messages.update(id, { status: status as any });
    }

    /**
     * Mark all messages in a conversation as read for a specific recipient
     */
    async markMessagesAsRead(conversationId: string, userWaId: string) {
        return await getDb().messages
            .where('conversationId')
            .equals(conversationId)
            .filter(msg => msg.to === userWaId && msg.status !== 'read')
            .modify({ status: 'read' });
    }

    /**
      * Get message count for a conversation
      */
    async getMessageCount(conversationId: string) {
        return await getDb().messages.where('conversationId').equals(conversationId).count();
    }

    /**
     * Get pending messages for a specific user (status = 'sent')
     * Used for retrying delivery when user comes online.
     * Uses the `status` index first, then filters by recipient — so the
     * per-presence-event cost scales with pending sends, not the whole table.
     */
    async getPendingMessages(userWaId: string) {
        return await getDb().messages
            .where('status')
            .equals('sent')
            .filter(msg => msg.to === userWaId)
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
        return await getDb().messages
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
        const message = await getDb().messages.get(messageId) as MessageWithQueue | undefined;
        if (message) {
            await getDb().messages.update(messageId, {
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
        await getDb().messages.update(messageId, {
            queueMetadata: undefined
        });
    }

    /**
     * Increment retry count for a message
     */
    async incrementRetryCount(messageId: string): Promise<void> {
        const message = await getDb().messages.get(messageId) as MessageWithQueue | undefined;
        if (message?.queueMetadata) {
            await this.updateQueueMetadata(messageId, {
                retryCount: message.queueMetadata.retryCount + 1,
                lastAttemptTimestamp: Date.now()
            });
        }
    }
}

export const messageDexieService = new MessageDexieService();

