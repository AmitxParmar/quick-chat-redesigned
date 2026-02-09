import Dexie, { Table } from 'dexie';
import { Message } from '@/types';

export class QuickChatDB extends Dexie {
    messages!: Table<Message, string>;

    constructor() {
        super('QuickChatDB');
        this.version(1).stores({
            messages: 'id, conversationId, timestamp', // Primary key: id, Indexes: conversationId, timestamp
        });

        // Version 2: Add compound index for efficient sorting by timestamp within a conversation
        this.version(2).stores({
            messages: 'id, conversationId, timestamp, [conversationId+timestamp]',
        });

        // Version 3: Add status index for queue management
        this.version(3).stores({
            messages: 'id, conversationId, timestamp, [conversationId+timestamp], status',
        }).upgrade(tx => {
            // Migration: Add queue metadata to existing pending messages
            return tx.table('messages').toCollection().modify((msg: any) => {
                if (!msg.queueMetadata && (msg.status === 'pending' || msg.status === 'sending')) {
                    msg.queueMetadata = {
                        retryCount: 0,
                        lastAttemptTimestamp: Date.now(),
                        enqueuedAt: Date.now()
                    };
                }
            });
        });
    }
}

export const db = new QuickChatDB();
