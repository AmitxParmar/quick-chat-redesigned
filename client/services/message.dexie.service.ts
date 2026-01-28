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
        // Query indexing: [conversationId+timestamp]
        // We want the LATEST 'limit' messages. 
        // Dexie's reverse() iterates from end of index.
        const messages = await db.messages
            .where('conversationId')
            .equals(conversationId)
            .reverse() // Start from newest
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
      * Get message count for a conversation
      */
    async getMessageCount(conversationId: string) {
        return await db.messages.where('conversationId').equals(conversationId).count();
    }
}

export const messageDexieService = new MessageDexieService();
