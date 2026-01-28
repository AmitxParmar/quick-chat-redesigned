import Dexie, { Table } from 'dexie';
import { Message } from '@/types';

export class QuickChatDB extends Dexie {
    messages!: Table<Message, string>;

    constructor() {
        super('QuickChatDB');
        this.version(1).stores({
            messages: 'id, conversationId, timestamp', // Primary key: id, Indexes: conversationId, timestamp
        });
    }
}

export const db = new QuickChatDB();
