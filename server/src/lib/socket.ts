import { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwtService from '@/lib/jwt';
import authRepository from '@/modules/auth/auth.repository';
import logger from '@/lib/logger';
import cacheService from '@/lib/cache';
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
    private pubClient: Redis | null = null;
    private subClient: Redis | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;

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
     * Optionally configures Redis adapter for horizontal scaling
     * @param httpServer - The HTTP server instance
     */
    public async initialize(httpServer: HttpServer): Promise<Server> {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.CLIENT_URL || 'http://localhost:3000',
                credentials: true,
            },
            perMessageDeflate: false,
            httpCompression: false
        });

        // Setup Redis adapter for horizontal scaling (if REDIS_URL is configured)
        await this.setupRedisAdapter();

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

        // Start heartbeat to refresh online status of connected users
        this.startHeartbeat();

        logger.info('Socket.io initialized');
        return this.io;
    }

    /**
     * Setup Redis adapter for multi-server socket event broadcasting
     * This enables horizontal scaling - socket events are broadcast to all server instances
     * 
     * Supports:
     * - Standard Redis: REDIS_URL=redis://localhost:6379
     * - Upstash Redis (TLS): UPSTASH_REDIS_URL=rediss://...upstash.io:6379
     * 
     * For Upstash, use the "Redis URL (TCP - Native)" from your Upstash console,
     * NOT the REST API URL. It should start with "rediss://" (note the extra 's' for TLS)
     */
    private async setupRedisAdapter(): Promise<void> {
        // Support both standard Redis and Upstash
        const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

        if (!redisUrl) {
            logger.info('Redis URL not configured - Socket.io running in single-server mode');
            logger.info('To enable horizontal scaling, set REDIS_URL or UPSTASH_REDIS_URL (TCP endpoint)');
            return;
        }

        try {
            // Upstash TLS connections use rediss:// protocol
            // ioredis handles TLS automatically when URL starts with "rediss://"
            const redisOptions = {
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                // For Upstash, password is embedded in the URL
            };

            // Create pub/sub clients for the Redis adapter
            this.pubClient = new Redis(redisUrl, redisOptions);
            this.subClient = this.pubClient.duplicate();

            // Wait for both connections with timeout
            const connectionTimeout = 10000; // 10 seconds

            await Promise.race([
                Promise.all([
                    new Promise<void>((resolve, reject) => {
                        this.pubClient!.on('ready', () => resolve());
                        this.pubClient!.on('error', (err) => reject(err));
                    }),
                    new Promise<void>((resolve, reject) => {
                        this.subClient!.on('ready', () => resolve());
                        this.subClient!.on('error', (err) => reject(err));
                    }),
                ]),
                new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error('Redis connection timeout')), connectionTimeout)
                ),
            ]);

            // Apply the Redis adapter
            this.io!.adapter(createAdapter(this.pubClient, this.subClient));

            const isUpstash = redisUrl.includes('upstash');
            logger.info(`Socket.io Redis adapter configured${isUpstash ? ' (Upstash)' : ''} - horizontal scaling enabled`);
        } catch (error) {
            logger.warn('Failed to setup Redis adapter, falling back to single-server mode:', error);
            // Clean up on failure
            this.pubClient?.disconnect();
            this.subClient?.disconnect();
            this.pubClient = null;
            this.subClient = null;
        }
    }

    /**
     * Gracefully shutdown Redis connections
     */
    public async shutdown(): Promise<void> {
        if (this.pubClient) {
            await this.pubClient.quit();
        }
        if (this.subClient) {
            await this.subClient.quit();
        }
        if (this.io) {
            this.io.close();
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        logger.info('Socket.io shutdown complete');
    }

    /**
     * Handles new socket connections
     */
    private handleConnection(socket: AuthenticatedSocket): void {
        const userId = socket.user?.id;
        const userWaId = socket.user?.waId;
        logger.info(`User connected: ${userId}`);

        // Join user's personal room for targeted notifications
        if (userId) {
            socket.join(`user:${userId}`);
        }
        if (userWaId) {
            socket.join(`user:${userWaId}`);
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
        socket.on(SocketEvents.DISCONNECT, async () => {
            logger.info(`User disconnected: ${userId}`);
            if (userWaId) {
                await cacheService.setUserOnline(userWaId, false);
                this.io?.emit('user:offline', { waId: userWaId, lastSeen: Date.now() });
            }
        });

        // Handle online status check
        socket.on('user:get-status', async (payload: { waId: string }) => {
            if (!payload?.waId) return;
            const isOnline = await cacheService.getUserOnlineStatus(payload.waId);
            socket.emit('user:status', {
                waId: payload.waId,
                isOnline,
                lastSeen: isOnline ? Date.now() : undefined
            });
        });

        // Handle message sending (Direct Socket Relay - No DB)
        socket.on(SocketEvents.MESSAGE_SEND, (payload: { message: Message; conversationId: string }) => {
            const { message, conversationId } = payload;

            if (!message || !conversationId) return;

            logger.info(`Relaying message ${message.id} for conversation ${conversationId}`);

            // Broadcast to conversation room (including sender if they have multiple tabs)
            // AND participants specifically
            const participants = [message.from, message.to];

            this.emitMessageCreated(conversationId, { message, conversationId }, participants);
        });

        // Handle messages marked as read
        socket.on(SocketEvents.MESSAGES_MARKED_AS_READ, (payload: { conversationId: string, waId: string, updatedMessages: number }) => {
            const { conversationId, waId } = payload;
            if (!conversationId || !waId) return;

            // Broadcast status update to the conversation
            // In a real persistence scenario, we would update DB here.
            // Since messages are local, we just tell others "User X read messages in this conversation"
            // But 'emitMessageStatusUpdated' usually requires a specific message ID.
            // If we want to mark ALL as read, we might need a different event or loop.
            // However, typical behavior is: User A reads conversation. User B sees double blue ticks on HIS messages to User A.

            // For now, let's emit a specific event that clients can use to update ALL messages from themselves in that conversation to 'read'
            // OR Reuse 'message:status-updated' but we don't have message IDs here (updatedMessages is just a count).

            // Re-broadcast the SAME event so clients can handle "Mark all my msg to this user as read"
            // Or better: The client sent 'MESSAGES_MARKED_AS_READ'.
            // Let's broadcast this to the room.

            socket.to(conversationId).emit(SocketEvents.MESSAGES_MARKED_AS_READ, {
                conversationId,
                readBy: waId,
                timestamp: Date.now()
            });

            logger.info(`User ${waId} marked messages as read in ${conversationId}`);
        });

        // Handle message status updates (Delivered/Read) from client
        socket.on(SocketEvents.MESSAGE_STATUS_UPDATED, (payload: { id: string; status: string; conversationId: string; updatedBy: string }) => {
            const { id, status, conversationId } = payload;
            if (!id || !status || !conversationId) return;

            // Relay to conversation
            socket.to(conversationId).emit(SocketEvents.MESSAGE_STATUS_UPDATED, {
                id,
                status,
                conversationId,
                updatedBy: payload.updatedBy
            });

            logger.info(`Relayed message status ${status} for ${id}`);
        });

        // Set initial online status
        if (userWaId) {
            cacheService.setUserOnline(userWaId, true);
            this.io?.emit('user:online', { waId: userWaId });
        }
    }

    /**
     * Periodic heartbeat to refresh online status in Redis
     * This prevents users from appearing offline if their Redis key expires
     * while they are still connected.
     */
    private startHeartbeat() {
        // Refresh every 30 seconds (TTL is 60s)
        this.heartbeatInterval = setInterval(async () => {
            if (!this.io) return;

            // Optimised heartbeat: iterate only over LOCAL sockets
            // fetchSockets() broadcasts to all nodes which is expensive and unnecessary for this local check
            const sockets = this.io.sockets.sockets;

            for (const [_, socket] of sockets) {
                const authSocket = socket as unknown as AuthenticatedSocket;
                if (authSocket.user?.waId) {
                    // Refresh TTL
                    await cacheService.setUserOnline(authSocket.user.waId, true);
                }
            }
        }, 30000);
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
    /**
     * Broadcasts a message created event to conversation room and participants
     */
    public emitMessageCreated(conversationId: string, payload: { message: Message; conversationId: string }, participants?: string[]): void {
        if (!this.io) return;

        // 1. Emit to conversation room (for active chat users)
        this.io.to(conversationId).emit('message:created', payload);

        // 2. Emit to specific user rooms (for conversation list updates)
        // If participants are provided, emit to their specific rooms
        if (participants && participants.length > 0) {
            participants.forEach(waId => {
                this.io?.to(`user:${waId}`).emit('message:created', payload);
            });
            logger.info(`Emitted message:created for conversation ${conversationId} to ${participants.length} participants`);
        } else {
            // Fallback: Global emit if no participants provided (trying to avoid this)
            // But typically this method is called with participants now
            // keeping global emit as safety net ONLY if no participants? 
            // Better to just Log warning and NOT emit globally to force migration
            logger.warn(`emitMessageCreated called without participants for ${conversationId} - skipping targeted emit`);
            // Legacy global emit (remove this once verified)
            // this.io.emit('message:created', payload); 
        }
    }

    /**
     * Broadcasts a conversation updated event
     * Client expectation: Conversation object
     */
    /**
     * Broadcasts a conversation updated event to participants
     */
    public emitConversationUpdated(conversationId: string, conversation: Conversation, participants?: string[]): void {
        if (!this.io) return;

        if (participants && participants.length > 0) {
            participants.forEach(waId => {
                this.io?.to(`user:${waId}`).emit('conversation:updated', conversation);
            });
            logger.info(`Emitted conversation:updated for conversation ${conversationId} to ${participants.length} participants`);
        } else {
            logger.warn(`emitConversationUpdated called without participants for ${conversationId}`);
            // Fallback to global emit only if necessary during migration
            // this.io.emit('conversation:updated', conversation);
        }
    }

    /**
     * Broadcasts a message status update event
     * Client expectation: { id, conversationId, status, message }
     */
    public emitMessageStatusUpdated(conversationId: string, payload: { id: string; conversationId: string; status: string; message: Message }, participants?: string[]): void {
        if (!this.io) return;

        // Always emit to conversation room (active chat)
        this.io.to(conversationId).emit('message:status-updated', payload);

        // Also emit to participants (specifically sender needs to know)
        if (participants && participants.length > 0) {
            participants.forEach(waId => {
                this.io?.to(`user:${waId}`).emit('message:status-updated', payload);
            });
        }

        logger.info(`Emitted message:status-updated for message ${payload.id}`);
    }

    /**
     * Broadcasts when messages are marked as read
     */
    public emitMessagesMarkedAsRead(conversationId: string, payload: { conversationId: string; waId: string; updatedMessages: number; conversation: Conversation }, participants?: string[]): void {
        if (!this.io) return;

        if (participants && participants.length > 0) {
            participants.forEach(waId => {
                this.io?.to(`user:${waId}`).emit('messages:marked-as-read', payload);
            });
        }

        logger.info(`Emitted messages:marked-as-read for conversation ${conversationId}`);
    }

    /**
     * Broadcasts a conversation deleted event
     */
    public emitConversationDeleted(conversationId: string, payload: { conversationId: string; waId: string; participants: string[] }, participants?: string[]): void {
        if (!this.io) return;

        if (participants && participants.length > 0) {
            participants.forEach(waId => {
                this.io?.to(`user:${waId}`).emit('conversation:deleted', payload);
            });
            logger.info(`Emitted conversation:deleted for conversation ${conversationId} to ${participants.length} participants`);
        } else {
            logger.warn(`emitConversationDeleted called without participants for ${conversationId}`);
        }
    }
}

export default SocketService.getInstance();
