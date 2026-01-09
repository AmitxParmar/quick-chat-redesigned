import { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import jwtService from '@/lib/jwt';
import authRepository from '@/modules/auth/auth.repository';
import logger from '@/lib/logger';
import {
    SocketEvents,
    type AuthenticatedSocket,
    type TaskEventPayload,
    type NotificationPayload,
} from '@/types/socket.type';
import { Conversation, Message } from '@prisma/client';

class SocketService {
    private io: Server | null = null;
    private static instance: SocketService;

    /**
     * Gets the singleton instance of SocketService
     */
    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    /**
     * Initializes Socket.io with the HTTP server
     * @param httpServer - The HTTP server instance
     */
    public initialize(httpServer: HttpServer): Server {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.CLIENT_URL || 'http://localhost:3000',
                credentials: true,
            },
        });

        // Authentication middleware
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                // Parse cookies from handshake headers
                const cookieHeader = socket.handshake.headers?.cookie || '';
                const cookies = this.parseCookies(cookieHeader);
                const token = cookies['access_token'] ||
                    socket.handshake.auth?.token ||
                    socket.handshake.headers?.authorization?.replace('Bearer ', '');

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                const payload = jwtService.verifyAccessToken(token);
                if (!payload) {
                    return next(new Error('Invalid or expired token'));
                }

                const user = await authRepository.findUserById(payload.userId);
                if (!user) {
                    return next(new Error('User not found'));
                }

                socket.user = user;
                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });

        // Connection handler
        this.io.on(SocketEvents.CONNECTION, (socket: AuthenticatedSocket) => {
            this.handleConnection(socket);
        });

        logger.info('Socket.io initialized');
        return this.io;
    }

    /**
     * Handles new socket connections
     */
    private handleConnection(socket: AuthenticatedSocket): void {
        const userId = socket.user?.id;
        logger.info(`User connected: ${userId}`);

        // Join user's personal room for targeted notifications
        if (userId) {
            socket.join(`user:${userId}`);
        }

        // Handle room joining
        socket.on(SocketEvents.JOIN_ROOM, (room: string) => {
            socket.join(room);
            logger.info(`User ${userId} joined room: ${room}`);
        });

        // Handle conversation joining (specific event from client)
        socket.on('conversation:join', (conversationId: string) => {
            socket.join(conversationId);
            logger.info(`User ${userId} joined conversation room: ${conversationId}`);
        });

        // Handle room leaving
        socket.on(SocketEvents.LEAVE_ROOM, (room: string) => {
            socket.leave(room);
            logger.info(`User ${userId} left room: ${room}`);
        });

        // Handle disconnection
        socket.on(SocketEvents.DISCONNECT, () => {
            logger.info(`User disconnected: ${userId}`);
        });
    }

    /**
     * Parse cookie header string into key-value pairs
     */
    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};
        if (!cookieHeader) return cookies;

        cookieHeader.split(';').forEach((cookie) => {
            const [name, ...rest] = cookie.split('=');
            if (name && rest.length > 0) {
                cookies[name.trim()] = rest.join('=').trim();
            }
        });
        return cookies;
    }

    /**
     * Gets the Socket.io server instance
     */
    public getIO(): Server | null {
        return this.io;
    }

    /**
     * Broadcasts a task created event to all connected clients
     */
    public emitTaskCreated(payload: TaskEventPayload): void {
        if (!this.io) return;
        this.io.emit(SocketEvents.TASK_CREATED, payload);
        logger.info(`Emitted task:created for task ${payload.taskId}`);
    }

    /**
     * Broadcasts a task updated event to all connected clients
     */
    public emitTaskUpdated(payload: TaskEventPayload): void {
        if (!this.io) return;
        this.io.emit(SocketEvents.TASK_UPDATED, payload);
        logger.info(`Emitted task:updated for task ${payload.taskId}`);
    }

    /**
     * Broadcasts a task deleted event to all connected clients
     */
    public emitTaskDeleted(taskId: string): void {
        if (!this.io) return;
        this.io.emit(SocketEvents.TASK_DELETED, { taskId });
        logger.info(`Emitted task:deleted for task ${taskId}`);
    }

    /**
     * Sends a notification to a specific user
     */
    public sendNotificationToUser(userId: string, notification: NotificationPayload): void {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(SocketEvents.NOTIFICATION, notification);
        logger.info(`Sent notification to user ${userId}`);
    }

    /**
     * Notifies a user when a task is assigned to them
     */
    public notifyTaskAssigned(userId: string, payload: TaskEventPayload): void {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(SocketEvents.TASK_ASSIGNED, payload);
        logger.info(`Notified user ${userId} of task assignment`);
    }

    /**
     * Broadcasts a message created event to conversation room
     * Client expectation: { message: Message; conversationId: string }
     */
    public emitMessageCreated(conversationId: string, payload: { message: Message; conversationId: string }): void {
        if (!this.io) return;
        // Emit to conversation room (so people actually viewing the chat get it)
        this.io.to(conversationId).emit('message:created', payload);



        // Better strategy: Emit to all participants' user rooms if we know them, 
        // OR rely on the fact that if they are online, they probably joined the conversation room via some list view?
        // Actually, users usually join conversation rooms only when they OPEN the conversation.
        // For conversation list updates, we need to emit to user rooms or a global event.

        // The client code listens to `conversation:updated` on `getSocekt()` which is global.
        // But `message:created` is also listened to in `useMessages` (active chat).

        // Let's also emit to the global namespace or specific user rooms if possible.
        // For simplicity and matching current client logic, we'll keep it as is but ensure the payload is correct.

        this.io.emit('message:created', payload);
        logger.info(`Emitted message:created for conversation ${conversationId}`);
    }

    /**
     * Broadcasts a conversation updated event
     * Client expectation: Conversation object
     */
    public emitConversationUpdated(conversationId: string, conversation: Conversation): void {
        if (!this.io) return;
        // Emit to global (or user specific rooms would be better, but sticking to existing pattern)
        this.io.emit('conversation:updated', conversation);
        logger.info(`Emitted conversation:updated for conversation ${conversationId}`);
    }

    /**
     * Broadcasts a message status update event
     * Client expectation: { id, conversationId, status, message }
     */
    public emitMessageStatusUpdated(conversationId: string, payload: { id: string; conversationId: string; status: string; message: Message }): void {
        if (!this.io) return;
        this.io.to(conversationId).emit('message:status-updated', payload);
        this.io.emit('message:status-updated', payload);
        logger.info(`Emitted message:status-updated for message ${payload.id}`);
    }

    /**
     * Broadcasts when messages are marked as read
     */
    public emitMessagesMarkedAsRead(conversationId: string, payload: { conversationId: string; waId: string; updatedMessages: number; conversation: Conversation }): void {
        if (!this.io) return;
        this.io.emit('messages:marked-as-read', payload);
        logger.info(`Emitted messages:marked-as-read for conversation ${conversationId}`);
    }
}

export default SocketService.getInstance();
