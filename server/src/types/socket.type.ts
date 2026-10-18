import { type Socket } from 'socket.io';
import { type SafeUser } from './auth.type';

export interface AuthenticatedSocket extends Socket {
    user?: SafeUser;
}

export enum SocketEvents {
    // Connection events
    CONNECTION = 'connection',
    DISCONNECT = 'disconnect',

    // Notification events
    NOTIFICATION = 'notification',

    // Room events
    JOIN_ROOM = 'room:join',
    LEAVE_ROOM = 'room:leave',

    // Presence subscription events (roster-room scoping)
    PRESENCE_WATCH = 'presence:watch',
    PRESENCE_UNWATCH = 'presence:unwatch',

    // Message events
    MESSAGE_SEND = 'message:send',
    MESSAGE_STATUS_UPDATED = 'message:status-updated',
    MESSAGES_MARKED_AS_READ = 'messages:marked-as-read',
}

export interface NotificationPayload {
    id: string;
    type: string;
    message: string;
    taskId?: string;
    createdAt: Date;
}
