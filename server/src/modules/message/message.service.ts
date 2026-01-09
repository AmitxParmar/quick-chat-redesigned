import messageRepository, { type PaginationQuery, type SearchQuery } from './message.repository';
import { MessageStatus, type Message } from '@prisma/client';
import { HttpNotFoundError, HttpBadRequestError, HttpForbiddenError } from '@/lib/errors';
import logger from '@/lib/logger';

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
 * Service layer for message business logic with Prisma
 */
export default class MessageService {
    /**
     * Gets all messages for a conversation with pagination
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

        //Check if user is participant
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

        const { messages, total } = await messageRepository.findByConversation(resolvedId, {
            page,
            limit,
        });

        return {
            messages,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalMessages: total,
                hasMore: page * limit < total,
            },
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
     */
    public async sendMessage(
        data: {
            to: string;
            text: string;
            type?: string;
        },
        options: MessageServiceOptions
    ): Promise<{ message: Message; conversationId: string }> {
        logger.info(`Sending message from ${options.userWaId} to ${data.to}`);

        // Validate required fields
        if (!data.to || !data.text) {
            throw new HttpBadRequestError('Missing required fields', ['to and text are required']);
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
}
