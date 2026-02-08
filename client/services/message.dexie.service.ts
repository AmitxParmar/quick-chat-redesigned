import { db } from './db';
import { Message } from '@/types';

class MessageDexieService {
    /**
     * Add or update a message in the local database
     */
    async addMessage(message: Message) {
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
        // Find messages in this conversation sent TO this user that are not read
        // Note: This might be expensive if we don't have an index on 'to'.
        // But for now we can filter.
        // Better: We want to update messages I SENT to THEM.
        // So 'to' should be the user who read them? Yes.

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
        // We want messages SENT TO this user that are stuck in 'sent'
        // We filter by 'to' and 'status'.
        // This scans all messages, might need optimization later but ok for now.
        return await db.messages
            .filter(msg => msg.to === userWaId && msg.status === 'sent')
            .toArray();
    }
}

export const messageDexieService = new MessageDexieService();
