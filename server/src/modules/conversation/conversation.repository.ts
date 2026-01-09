import { type Conversation, type User } from '@prisma/client';
import prisma from '@/lib/prisma';

/**
 * Repository for conversation operations using Prisma
 */
export class ConversationRepository {
    /**
     * Find conversation by exact participants (2-way match)
     */
    public async findByParticipants(
        waId1: string,
        waId2: string
    ): Promise<Conversation | null> {
        const conversations = await prisma.conversation.findMany({
            where: {
                AND: [
                    {
                        participants: {
                            some: { waId: waId1 },
                        },
                    },
                    {
                        participants: {
                            some: { waId: waId2 },
                        },
                    },
                ],
            },
        });

        // Filter to ensure exactly 2 participants
        return conversations.find((c) => c.participants.length === 2) || null;
    }

    /**
     * Create a new conversation
     */
    public async create(participants: Array<{
        waId: string;
        name?: string;
        profilePicture?: string;
    }>): Promise<Conversation> {
        const conversation = await prisma.conversation.create({
            data: {
                participants: participants,
                conversationId: '', // Temporary value
                unreadCount: 0,
                isArchived: false,
            },
        });

        // Update conversationId to match the generated id
        return prisma.conversation.update({
            where: { id: conversation.id },
            data: { conversationId: conversation.id },
        });
    }

    /**
     * Find conversation by ID
     */
    public async findById(id: string): Promise<Conversation | null> {
        return prisma.conversation.findUnique({
            where: { id },
        });
    }

    /**
     * Get all conversations for a user
     */
    public async findByUserWaId(waId: string): Promise<Conversation[]> {
        // Fetch all non-archived conversations where user is participant
        const conversations = await prisma.conversation.findMany({
            where: {
                isArchived: false,
                participants: {
                    some: { waId },
                },
            },
        });

        // Filter conversations that have valid lastMessage and sort by timestamp
        return conversations
            .filter((c) => {
                const lm = c.lastMessage;
                return lm && lm.text && lm.timestamp;
            })
            .sort((a, b) => {
                const aTimestamp = (a.lastMessage)?.timestamp || 0;
                const bTimestamp = (b.lastMessage)?.timestamp || 0;
                return bTimestamp - aTimestamp;
            });
    }

    /**
     * Update conversation's lastMessage and unreadCount
     */
    public async updateLastMessage(
        id: string,
        lastMessage,
        unreadCount?: number
    ): Promise<Conversation> {
        // Sanitize lastMessage to match schema type
        const sanitizedLastMessage = {
            text: lastMessage.text || '',
            timestamp: typeof lastMessage.timestamp === 'number'
                ? lastMessage.timestamp
                : new Date(lastMessage.timestamp).getTime(), // Handle Date objects or strings if necessary
            from: lastMessage.from,
            status: lastMessage.status,
        };

        const updateData: Partial<Conversation> = { lastMessage: sanitizedLastMessage };

        if (unreadCount !== undefined) {
            updateData.unreadCount = unreadCount;
        }

        return prisma.conversation.update({
            where: { id },
            data: updateData,
        });
    }

    /**
     * Mark conversation as read (only reset unreadCount)
     */
    public async markAsRead(id: string): Promise<Conversation> {
        return prisma.conversation.update({
            where: { id },
            data: {
                unreadCount: 0,
            }
        });
    }

    /**
     * Update lastMessage status
     */
    public async updateLastMessageStatus(
        id: string,
        status: 'sent' | 'delivered' | 'read' | 'failed'
    ): Promise<Conversation> {
        const conversation = await this.findById(id);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        return prisma.conversation.update({
            where: { id },
            data: {
                lastMessage: {
                    ...(conversation.lastMessage),
                    status,
                },
            } as Conversation,
        });
    }

    /**
     * Archive conversation (soft delete)
     */
    public async archive(id: string): Promise<Conversation> {
        return prisma.conversation.update({
            where: { id },
            data: { isArchived: true },
        });
    }

    /**
     * Delete conversation permanently
     */
    public async delete(id: string): Promise<Conversation> {
        return prisma.conversation.delete({
            where: { id },
        });
    }

    /**
     * Check if user is participant in conversation
     */
    public async isParticipant(conversationId: string, waId: string): Promise<boolean> {
        const conversation = await this.findById(conversationId);
        if (!conversation) return false;

        return (conversation.participants).some((p) => p.waId === waId);
    }

    /**
     * Find users by waIds
     */
    public async findUsersByWaIds(waIds: string[]): Promise<User[]> {
        return prisma.user.findMany({
            where: {
                waId: { in: waIds },
            },
        });
    }
}

export default new ConversationRepository();
