import { Message, type Conversation } from '@prisma/client';
import conversationRepository from './conversation.repository';
import prisma from '@/lib/prisma';
import { HttpBadRequestError, HttpNotFoundError, HttpForbiddenError } from '@/lib/errors';
import logger from '@/lib/logger';
import socketService from '@/lib/socket';
import cacheService, { CacheKeys, CacheTTL } from '@/lib/cache';

/**
 * Normalize WhatsApp ID (add 91 prefix if missing)
 */
const normalizeWaId = (waId: string): string => {
    return waId?.startsWith('91') ? waId.trim() : `91${waId?.trim()}`;
};

export default class ConversationService {
    /**
     * Helper to invalidate user's conversation list cache
     */
    private async invalidateUserCache(waId: string): Promise<void> {
        const key = CacheKeys.USER_CONVERSATIONS(waId);
        await cacheService.del(key);
        logger.debug(`[Cache] Invalidated conversation list for user ${waId}`);
    }

    /**
     * Get or create conversation ID for two participants
     */
    public async getConversationId(
        fromWaId: string,
        toWaId: string
    ): Promise<{
        id: string;
        conversationId: string;
        isNew: boolean;
    }> {
        const fromId = normalizeWaId(fromWaId);
        const toId = normalizeWaId(toWaId);

        // Validation
        if (!fromId || !toId) {
            throw new HttpBadRequestError('Both from and to must be non-empty strings', [
                'Both from and to must be non-empty strings',
            ]);
        }

        if (fromId === toId) {
            throw new HttpBadRequestError(
                'Cannot create conversation with the same participant',
                ['Cannot create conversation with the same participant']
            );
        }

        // Look for existing conversation
        const existingConversation = await conversationRepository.findByParticipants(
            fromId,
            toId
        );

        if (existingConversation) {
            logger.info(
                `[getConversationId] from=${fromId} to=${toId} existing=${existingConversation.id}`
            );

            return {
                id: existingConversation.id,
                conversationId: existingConversation.conversationId || existingConversation.id,
                isNew: false,
            };
        }

        // Verify both users exist
        const users = await conversationRepository.findUsersByWaIds([fromId, toId]);

        if (users.length !== 2) {
            const foundIds = users.map((u) => u.waId);
            const missingIds = [fromId, toId].filter((id) => !foundIds.includes(id));
            throw new HttpNotFoundError(`User(s) not found: ${missingIds.join(', ')}`);
        }

        // Create new conversation
        const participants = users.map((user) => ({
            waId: user.waId,
            name: user.name || `User ${user.waId}`,
            profilePicture: user.profilePicture || undefined,
        }));

        // Create conversation with conversationId
        const newConversation = await conversationRepository.create(participants);

        // Invalidate cache for both participants
        await Promise.all([
            this.invalidateUserCache(fromId),
            this.invalidateUserCache(toId),
        ]);

        logger.info(
            `[getConversationId] created conversationId=${newConversation.id} participants=${participants.map((p) => p.waId).join(',')}`
        );

        return {
            id: newConversation.id,
            conversationId: newConversation.conversationId,
            isNew: true,
        };
    }

    /**
     * Get all conversations for a user with caching and pagination
     */
    public async getConversations(
        waId: string,
        limit: number = 20,
        cursor?: string
    ): Promise<{ conversations: Conversation[]; nextCursor: string | null }> {
        // Prepare cache key
        const cacheKey = CacheKeys.USER_CONVERSATIONS(waId);

        // Try to fetch from cache if requesting first page (no cursor)
        if (!cursor) {
            const cached = await cacheService.get<{
                conversations: Conversation[];
                nextCursor: string | null;
            }>(cacheKey);

            if (cached) {
                logger.debug(`[getConversations] Cache HIT for user ${waId}`);
                return cached;
            }
        }

        // Fetch from DB
        const result = await conversationRepository.findByUserWaId(waId, limit, cursor);

        logger.info(
            `[getConversations] Found ${result.conversations.length} conversations for user ${waId} (DB)`
        );

        // Cache result if it's the first page
        if (!cursor) {
            await cacheService.set(cacheKey, result, CacheTTL.USER_CONVERSATIONS);
            logger.debug(`[getConversations] Cache SET for user ${waId}`);
        }

        return result;
    }

    /**
     * Mark all messages in conversation as read
     */
    public async markAsRead(
        conversationId: string,
        waId: string
    ): Promise<{
        lastMessageStatusUpdated: boolean;
        lastMessageBefore: any;
        lastMessageAfter: any;
        affectedMessagesCount: number;
    }> {
        // Verify conversation exists and user is participant
        const conversation = await conversationRepository.findById(conversationId);
        if (!conversation) {
            throw new HttpNotFoundError('Conversation not found');
        }

        const isParticipant = await conversationRepository.isParticipant(
            conversationId,
            waId
        );
        if (!isParticipant) {
            throw new HttpForbiddenError(
                'You are not a participant in this conversation'
            );
        }

        const lastMessageBefore = conversation.lastMessage;

        // Fetch unread messages first so we can emit events for them
        const unreadMessages = await prisma.message.findMany({
            where: {
                conversationId,
                to: waId,
                status: { in: ['sent', 'delivered'] },
            },
            select: { id: true, conversationId: true, status: true } // Select minimal fields
        });

        logger.info(`[markAsRead] Found ${unreadMessages.length} unread messages for user ${waId} in conversation ${conversationId}`);

        // Update all unread messages to 'read'
        const updateResult = await prisma.message.updateMany({
            where: {
                conversationId,
                to: waId,
                status: { in: ['sent', 'delivered'] },
            },
            data: {
                status: 'read',
            },
        });

        logger.info(
            `[markAsRead] Updated ${updateResult.count} messages to 'read' in conversation ${conversationId}`
        );

        // Emit status updates for EACH updated message
        unreadMessages.forEach(msg => {
            // logger.info(`[markAsRead] Emitting status update for message: ${msg.id}`);
            socketService.emitMessageStatusUpdated(conversationId, {
                id: msg.id,
                conversationId: msg.conversationId,
                status: 'read',
                message: { ...msg, status: 'read' } as any,
            });
        });

        // Find latest message
        const lastMsg = await prisma.message.findFirst({
            where: { conversationId },
            orderBy: { timestamp: 'desc' },
        });

        // Reset unreadCount for the user (assuming repo method handles this)
        await conversationRepository.markAsRead(conversationId);

        let lastMessageUpdated = false;

        // If we found a last message, update the conversation's lastMessage snapshot
        if (lastMsg) {
            await conversationRepository.updateLastMessage(conversationId, lastMsg);
            lastMessageUpdated = true;
        }

        // Get updated conversation
        const updatedConversation = await conversationRepository.findById(conversationId);

        // Cache Invalidation: Invalidate user's conversation list
        // because unread count changed
        await this.invalidateUserCache(waId);

        // Emit socket events
        if (updatedConversation) {
            const participants = updatedConversation.participants.map((p) => p.waId);

            socketService.emitConversationUpdated(conversationId, updatedConversation, participants);

            // Emit bulk mark-as-read event
            socketService.emitMessagesMarkedAsRead(conversationId, {
                conversationId,
                waId,
                updatedMessages: updateResult.count,
                conversation: updatedConversation,
            }, participants);

            // Emit status update for the last message so sender sees the blue tick immediately
            if (lastMsg && lastMsg.status === 'read') {
                socketService.emitMessageStatusUpdated(conversationId, {
                    id: lastMsg.id,
                    conversationId,
                    status: 'read',
                    message: lastMsg,
                }, [lastMsg.from, lastMsg.to]);
            }

            logger.info(
                `[markAsRead] Emitted socket events for conversation: ${conversationId}, affected messages: ${updateResult.count}`
            );
        }

        return {
            lastMessageStatusUpdated: lastMessageUpdated,
            lastMessageBefore,
            lastMessageAfter: updatedConversation?.lastMessage,
            affectedMessagesCount: updateResult.count,
        };
    }

    /**
     * Delete conversation (soft or hard delete)
     */
    public async deleteConversation(
        conversationId: string,
        waId: string,
        deleteType: 'soft' | 'hard' = 'soft'
    ): Promise<{
        conversationId: string;
        deleteType: string;
        deletedAt: Date;
        conversation?: Conversation;
    }> {
        // Verify conversation exists and user is participant
        const conversation = await conversationRepository.findById(conversationId);
        if (!conversation) {
            throw new HttpNotFoundError('Conversation not found');
        }

        const isParticipant = await conversationRepository.isParticipant(
            conversationId,
            waId
        );
        if (!isParticipant) {
            throw new HttpForbiddenError(
                'You are not a participant in this conversation'
            );
        }

        let result: Conversation;
        const participants = conversation.participants.map(p => p.waId);

        if (deleteType === 'soft') {
            // Archive conversation
            result = await conversationRepository.archive(conversationId);

            // Emit socket event
            socketService.emitConversationUpdated(conversationId, result, participants);

            logger.info(`[deleteConversation] Archived conversation: ${conversationId}`);

            // Invalidate cache for ALL participants (since archive is shared)
            await Promise.all(participants.map(p => this.invalidateUserCache(p)));

            return {
                conversationId,
                deleteType: 'soft',
                deletedAt: new Date(),
                conversation: result,
            };
        } else {
            // Hard delete: Delete all messages first
            const messagesDeleted = await prisma.message.deleteMany({
                where: { conversationId },
            });

            logger.info(
                `[deleteConversation] Deleted ${messagesDeleted.count} messages for conversation: ${conversationId}`
            );

            // Delete conversation
            result = await conversationRepository.delete(conversationId);

            // Emit socket event
            socketService.emitConversationDeleted(conversationId, {
                conversationId,
                waId,
                participants: participants,
            }, participants);

            logger.info(
                `[deleteConversation] Permanently deleted conversation: ${conversationId}`
            );

            // Invalidate cache for ALL participants
            await Promise.all(participants.map(p => this.invalidateUserCache(p)));

            return {
                conversationId,
                deleteType: 'hard',
                deletedAt: new Date(),
            };
        }
    }
}
