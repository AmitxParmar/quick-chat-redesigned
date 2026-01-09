import { type Socket } from 'socket.io';
import { type SafeUser } from './auth.type';

export interface AuthenticatedSocket extends Socket {
    user?: SafeUser;
}

export enum SocketEvents {
    // Connection events
    CONNECTION = 'connection',
    DISCONNECT = 'disconnect',

    // Task events
    TASK_CREATED = 'task:created',
    TASK_UPDATED = 'task:updated',
    TASK_DELETED = 'task:deleted',

    // Notification events
    NOTIFICATION = 'notification',
    TASK_ASSIGNED = 'task:assigned',

    // Room events
    JOIN_ROOM = 'room:join',
    LEAVE_ROOM = 'room:leave',
}

export interface TaskEventPayload {
    taskId: string;
    task?: unknown;
    previousAssigneeId?: string;
    newAssigneeId?: string;
}

export interface NotificationPayload {
    id: string;
    type: string;
    message: string;
    taskId?: string;
    createdAt: Date;
}
