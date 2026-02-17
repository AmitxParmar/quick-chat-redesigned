import Dexie, { Table } from 'dexie';
import { Message, MessageWithQueue } from '@/types';

export class QuickChatDB extends Dexie {
    messages!: Table<MessageWithQueue, string>;

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

// Lazy singleton — Dexie instance is only created when first accessed,
// deferring IndexedDB initialization from module load time
let _db: QuickChatDB | null = null;

export function getDb(): QuickChatDB {
    if (!_db) {
        _db = new QuickChatDB();
    }
    return _db;
}

/**
 * @deprecated Use getDb() instead for lazy initialization.
 * Kept for backward compatibility — returns the lazily-initialized instance.
 */
export const db = new Proxy({} as QuickChatDB, {
    get(_target, prop, receiver) {
        const instance = getDb();
        const value = Reflect.get(instance, prop, receiver);
        if (typeof value === 'function') {
            return value.bind(instance);
        }
        return value;
    },
});
