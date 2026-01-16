import messageRepository, { type PaginationQuery, type SearchQuery } from './message.repository';
import { MessageStatus, type Message } from '@prisma/client';
import { HttpNotFoundError, HttpBadRequestError, HttpForbiddenError, HttpConflictError } from '@/lib/errors';
import logger from '@/lib/logger';
import cacheService, { CacheKeys, CacheTTL } from '@/lib/cache';

export interface MessageServiceOptions {
    userId?: string;
    userWaId: string;
}

export interface MessagePaginationResult {
    messages: Message[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalMessages: number;
        hasMore: boolean;
    };
    cached?: boolean; // Indicates if result came from cache
}

export interface MessageSearchResult {
    messages: Message[];
    searchQuery: string;
    pagination: {
        currentPage: number;
        totalPages: number;
        totalMessages: number;
        hasMore: boolean;
    };
}

/**
 * Service layer for message business logic with Prisma and Redis caching
 */
export default class MessageService {
    /**
     * Gets all messages for a conversation with pagination
     * Uses read-through caching for page 1 (most recent messages)
     */
    public async getMessages(
        conversationId: string,
        query: PaginationQuery,
        options: MessageServiceOptions
    ): Promise<MessagePaginationResult> {
        logger.info(`Getting messages for conversation: ${conversationId}`);

        // Resolve conversationId if it's a public ID
        const resolvedId = await messageRepository.resolveConversationId(conversationId);
        if (!resolvedId) {
            throw new HttpBadRequestError('Invalid conversation ID', [
                'Conversation not found',
            ]);
        }

        // Check if user is participant
        const isParticipant = await messageRepository.isUserParticipant(
            options.userWaId,
            resolvedId
        );

        if (!isParticipant) {
            throw new HttpForbiddenError('Access denied', [
                'You are not a participant in this conversation',
            ]);
        }

        const page = query.page || 1;
        const limit = Math.min(query.limit || 25, 100);

        // Try cache for page 1 (most recent messages)
        if (page === 1) {
            const cachedMessages = await cacheService.getRecentMessages<Message>(resolvedId, limit);

            if (cachedMessages.length >= limit) {
                logger.info(`Cache HIT for conversation ${resolvedId} (${cachedMessages.length} messages)`);

                // Get total count from cache or DB
                const cachedCount = await cacheService.get<number>(CacheKeys.MESSAGES_COUNT(resolvedId));
                const total = cachedCount ?? await this.getAndCacheMessageCount(resolvedId);

                return {
                    messages: cachedMessages.slice(0, limit),
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalMessages: total,
                        hasMore: limit < total,
                    },
                    cached: true,
                };
            }
        }

        // Cache miss or requesting older pages - fetch from DB
        logger.info(`Cache MISS for conversation ${resolvedId}, fetching from DB`);

        const { messages, total } = await messageRepository.findByConversation(resolvedId, {
            page,
            limit,
        });

        // Warm cache for page 1
        if (page === 1 && messages.length > 0) {
            await this.warmMessagesCache(resolvedId, messages, total);
        }

        return {
            messages,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalMessages: total,
                hasMore: page * limit < total,
            },
            cached: false,
        };
    }

    /**
     * Searches messages across conversations
     */
    public async searchMessages(
        searchQuery: SearchQuery,
        options: MessageServiceOptions
    ): Promise<MessageSearchResult> {
        logger.info(`Searching messages: "${searchQuery.query}"`);

        if (!searchQuery.query || searchQuery.query.trim().length === 0) {
            throw new HttpBadRequestError('Search query is required', [
                'Query cannot be empty',
            ]);
        }

        // If conversationId provided, verify access
        if (searchQuery.conversationId) {
            const resolvedId = await messageRepository.resolveConversationId(
                searchQuery.conversationId
            );

            if (!resolvedId) {
                throw new HttpBadRequestError('Invalid conversation ID', [
                    'Conversation not found',
                ]);
            }

            const isParticipant = await messageRepository.isUserParticipant(
                options.userWaId,
                resolvedId
            );

            if (!isParticipant) {
                throw new HttpForbiddenError('Access denied', [
                    'You are not a participant in this conversation',
                ]);
            }

            searchQuery.conversationId = resolvedId;
        }

        const page = searchQuery.page || 1;
        const limit = Math.min(searchQuery.limit || 25, 100);

        const { messages, total } = await messageRepository.searchMessages(
            options.userWaId,
            searchQuery
        );

        return {
            messages,
            searchQuery: searchQuery.query,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalMessages: total,
                hasMore: page * limit < total,
            },
        };
    }

    /**
     * Creates and sends a new message
     * Includes idempotency check to prevent duplicate messages
     */
    public async sendMessage(
        data: {
            to: string;
            text: string;
            type?: string;
            correlationId?: string; // Idempotency key from client
        },
        options: MessageServiceOptions
    ): Promise<{ message: Message; conversationId: string }> {
        logger.info(`Sending message from ${options.userWaId} to ${data.to}`);

        // Validate required fields
        if (!data.to || !data.text) {
            throw new HttpBadRequestError('Missing required fields', ['to and text are required']);
        }

        // Check idempotency - prevent duplicate messages
        if (data.correlationId) {
            const isDuplicate = await cacheService.checkIdempotency(data.correlationId);
            if (isDuplicate) {
                throw new HttpConflictError('Duplicate message detected', [
                    'A message with this correlationId was already processed',
                ]);
            }
        }

        // Get sender user
        const senderUser = await messageRepository.getUserByWaId(options.userWaId);
        if (!senderUser) {
            throw new HttpNotFoundError('Sender not found');
        }

        // Get receiver user
        const receiverUser = await messageRepository.getUserByWaId(data.to);
        if (!receiverUser) {
            throw new HttpNotFoundError('Receiver not found');
        }

        // Create message and update/create conversation
        const { message, conversation } = await messageRepository.create({
            from: options.userWaId,
            to: data.to,
            text: data.text,
            type: data.type,
            senderUser,
            receiverUser,
        });

        logger.info(`Message created: ${message.id}`);

        // Update cache in background (non-blocking)
        this.updateCacheAfterSend(conversation.id, message, [options.userWaId, data.to]).catch(
            (err) => logger.error('Cache update failed:', err)
        );

        // Emit socket events for real-time updates
        const socketService = (await import('@/lib/socket')).default;
        const conversationId = conversation.id;

        const payload = {
            message,
            conversationId,
        };

        // Emit message created event
        socketService.emitMessageCreated(conversationId, payload);

        // Emit conversation updated event
        socketService.emitConversationUpdated(conversationId, conversation);

        return {
            message,
            conversationId: conversation.id,
        };
    }

    /**
     * Updates message delivery status
     */
    public async updateMessageStatus(
        messageId: string,
        status: string,
        options: MessageServiceOptions
    ): Promise<Message> {
        logger.info(`Updating message ${messageId} status to ${status}`);

        // Validate status
        const validStatuses = ['sent', 'delivered', 'read', 'failed'];
        if (!validStatuses.includes(status)) {
            throw new HttpBadRequestError('Invalid status', [
                'Status must be one of: sent, delivered, read, failed',
            ]);
        }

        const updatedMessage = await messageRepository.updateStatus(
            messageId,
            status as MessageStatus
        );

        if (!updatedMessage) {
            throw new HttpNotFoundError('Message not found');
        }

        logger.info(`Message ${messageId} status updated to ${status}`);

        // Emit socket event for real-time status update
        const socketService = (await import('@/lib/socket')).default;

        const payload = {
            id: updatedMessage.id, // Client expects 'id'
            conversationId: updatedMessage.conversationId,
            status: updatedMessage.status,
            message: updatedMessage,
        };

        socketService.emitMessageStatusUpdated(updatedMessage.conversationId, payload);

        return updatedMessage;
    }

    // ============================================
    // PRIVATE CACHE HELPER METHODS
    // ============================================

    /**
     * Warm the messages cache for a conversation
     */
    private async warmMessagesCache(
        conversationId: string,
        messages: Message[],
        total: number
    ): Promise<void> {
        try {
            // Store messages in cache (newest first)
            for (const message of messages.reverse()) {
                await cacheService.cacheRecentMessage(conversationId, message);
            }

            // Cache the total count
            await cacheService.set(
                CacheKeys.MESSAGES_COUNT(conversationId),
                total,
                CacheTTL.MESSAGES_RECENT
            );

            logger.info(`Warmed cache for conversation ${conversationId} with ${messages.length} messages`);
        } catch (error) {
            logger.error(`Failed to warm cache for ${conversationId}:`, error);
        }
    }

    /**
     * Get and cache message count for a conversation
     */
    private async getAndCacheMessageCount(conversationId: string): Promise<number> {
        const { total } = await messageRepository.findByConversation(conversationId, { page: 1, limit: 1 });
        await cacheService.set(CacheKeys.MESSAGES_COUNT(conversationId), total, CacheTTL.MESSAGES_RECENT);
        return total;
    }

    /**
     * Update cache after sending a message
     */
    private async updateCacheAfterSend(
        conversationId: string,
        message: Message,
        participantWaIds: string[]
    ): Promise<void> {
        // Add new message to recent messages cache
        await cacheService.cacheRecentMessage(conversationId, message);

        // Increment message count if cached
        const countKey = CacheKeys.MESSAGES_COUNT(conversationId);
        const cachedCount = await cacheService.get<number>(countKey);
        if (cachedCount !== null) {
            await cacheService.set(countKey, cachedCount + 1, CacheTTL.MESSAGES_RECENT);
        }

        // Invalidate participant conversation lists (they'll refetch)
        await cacheService.invalidateConversationCaches(conversationId, participantWaIds);
    }
}

