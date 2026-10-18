import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { normalizeWaId } from '@/utils/wa-id';
import type { Message, Conversation, User, MessageStatus, Prisma } from '@prisma/client';

/**
 * Message with populated conversation
 */
export interface MessageWithConversation extends Message {
    conversation: Conversation | null;
}

export interface PaginationQuery {
    page?: number;
    limit?: number;
}

export interface CursorPaginationQuery extends PaginationQuery {
    /** Keyset cursor: return messages strictly older than this timestamp. */
    before?: number;
}

export interface SearchQuery extends PaginationQuery {
    query: string;
    conversationId?: string;
}

/**
 * Repository for message database operations with Prisma
 */
export class MessageRepository {
    /**
     * Finds all messages for a conversation with pagination
     */
    public async findByConversation(
        conversationId: string,
        options: PaginationQuery = {}
    ): Promise<{ messages: Message[]; total: number }> {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 25, 100);
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: { conversationId },
                orderBy: { timestamp: 'desc' }, // Newest first
                skip,
                take: limit,
            }),
            prisma.message.count({
                where: { conversationId },
            }),
        ]);

        return { messages, total };
    }

    /**
     * Keyset pagination for message history (PERFORMANCE_ENGINEERING 3.5):
     * newest `limit` messages strictly before `before` (or the newest page
     * when omitted), ordered by the @@index([conversationId, timestamp])
     * compound index. No offsets — concurrent inserts cannot shift or
     * duplicate windows. Returns the next cursor for the following page.
     */
    public async findByConversationBefore(
        conversationId: string,
        before?: number,
        limit = 25
    ): Promise<{ messages: Message[]; hasMore: boolean; nextCursor: number | null }> {
        const take = Math.min(limit, 100);

        const rows = await prisma.message.findMany({
            where: {
                conversationId,
                ...(typeof before === 'number' ? { timestamp: { lt: before } } : {}),
            },
            orderBy: { timestamp: 'desc' },
            take: take + 1, // +1 to detect a next page
        });

        const hasMore = rows.length > take;
        const messages = hasMore ? rows.slice(0, take) : rows;
        const nextCursor = hasMore && messages.length > 0
            ? messages[messages.length - 1].timestamp
            : null;

        return { messages, hasMore, nextCursor };
    }

    /**
     * Finds messages created after a timestamp (keyset catch-up for
     * reconnects — PERFORMANCE_ENGINEERING 1.3). Uses the
     * @@index([conversationId, timestamp]) compound index: no offsets,
     * so concurrent inserts can't shift or duplicate windows.
     */
    public async findByConversationSince(
        conversationId: string,
        since: number,
        limit = 100
    ): Promise<Message[]> {
        return prisma.message.findMany({
            where: { conversationId, timestamp: { gt: since } },
            orderBy: { timestamp: 'asc' },
            take: Math.min(limit, 100),
        });
    }

    /**
     * Searches messages by text content
     */
    public async searchMessages(
        userWaId: string,
        searchQuery: SearchQuery
    ): Promise<{ messages: MessageWithConversation[]; total: number }> {
        const page = searchQuery.page || 1;
        const limit = Math.min(searchQuery.limit || 25, 100);
        const skip = (page - 1) * limit;

        const currentWaId = normalizeWaId(userWaId);

        // Build where clause
        const where: Prisma.MessageWhereInput = {
            OR: [{ from: currentWaId }, { to: currentWaId }],
            text: {
                contains: searchQuery.query.trim(),
                mode: 'insensitive',
            },
        };

        // Filter by specific conversation if provided
        if (searchQuery.conversationId) {
            where.conversationId = searchQuery.conversationId;
        }

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
                include: {
                    conversation: true,
                },
            }),
            prisma.message.count({ where }),
        ]);

        return { messages, total };
    }

    /**
     * Creates a new message and updates/creates conversation
     */
    public async create(data: {
        from: string;
        to: string;
        text: string;
        type?: string;
        senderUser: User;
        receiverUser: User;
    }): Promise<{ message: Message; conversation: Conversation }> {
        const fromId = normalizeWaId(data.from);
        const toId = normalizeWaId(data.to);

        // Find existing conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    {
                        participants: {
                            some: { waId: fromId },
                        },
                    },
                    {
                        participants: {
                            some: { waId: toId },
                        },
                    },
                ],
            },
        });

        const timestamp = Date.now();

        // Create or update conversation
        if (!conversation) {
            const newConversationId = randomUUID();
            conversation = await prisma.conversation.create({
                data: {
                    conversationId: newConversationId,
                    participants: [
                        {
                            waId: fromId,
                            name: data.senderUser.name || `User ${fromId}`,
                            profilePicture: data.senderUser.profilePicture,
                        },
                        {
                            waId: toId,
                            name: data.receiverUser.name || `User ${toId}`,
                            profilePicture: data.receiverUser.profilePicture,
                        },
                    ],
                    lastMessage: {
                        text: data.text,
                        timestamp,
                        from: fromId,
                        status: 'sent',
                    },
                    unreadCount: 1,
                },
            });
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                from: fromId,
                to: toId,
                text: data.text,
                timestamp,
                status: 'sent',
                type: (data.type as any) || 'text',
                waId: fromId,
                direction: 'outgoing',
                contact: {
                    name: data.senderUser.name || `User ${fromId}`,
                    waId: fromId,
                },
            },
        });

        // Update conversation's last message
        conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessage: {
                    text: data.text,
                    timestamp: message.timestamp,
                    from: fromId,
                    status: 'sent',
                },
                unreadCount: { increment: 1 },
            },
        });

        return { message, conversation };
    }

    /**
     * Updates message status
     */
    public async updateStatus(
        messageId: string,
        status: MessageStatus
    ): Promise<Message | null> {
        const existing = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true } });
        if (!existing) return null;

        return prisma.message.update({
            where: { id: messageId },
            data: { status },
        });
    }

    /**
     * Checks if user is participant in conversation
     */
    public async isUserParticipant(
        userWaId: string,
        conversationId: string
    ): Promise<boolean> {
        const currentWaId = normalizeWaId(userWaId);

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { participants: true },
        });

        if (!conversation || !conversation.participants) return false;

        return (conversation.participants as any[]).some((p: any) => p?.waId === currentWaId);
    }

    /**
     * Resolves conversationId (handles both ObjectId and unique conversationId field)
     */
    public async resolveConversationId(conversationId: string): Promise<string | null> {
        const conversation = await prisma.conversation.findFirst({
            where: {
                OR: [
                    { id: conversationId },
                    { conversationId },
                ],
            },
            select: { id: true },
        });

        return conversation?.id || null;
    }

    /**
     * Gets conversation by ID
     */
    public async getConversation(conversationId: string): Promise<Conversation | null> {
        return prisma.conversation.findUnique({
            where: { id: conversationId },
        });
    }

    /**
     * Gets user by waId
     */
    public async getUserByWaId(waId: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { waId },
        });
    }
}

export default new MessageRepository();
