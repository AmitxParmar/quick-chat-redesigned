import { type Contact } from '@prisma/client';
import prisma from '@/lib/prisma';

/**
 * Contact with populated user data
 */
export interface PopulatedContact {
    id: string;
    waId: string;
    name: string | null;
    profilePicture: string | null;
    status: string;
    isOnline: boolean;
    lastSeen: Date;
    nickname: string | null;
}

/**
 * User search result
 */
export interface UserSearchResult {
    id: string;
    waId: string;
    name: string | null;
    profilePicture: string | null;
    status: string;
    isOnline: boolean;
    isContact: boolean;
}

/**
 * Repository for contact operations using Prisma
 */
export class ContactRepository {
    /**
     * Find all contacts for a user
     */
    public async findByUserId(userId: string): Promise<Contact[]> {
        return prisma.contact.findMany({
            where: {
                userId,
                isBlocked: false,
            },
        });
    }

    /**
     * Find contact user by ID
     */
    public async findUserById(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                waId: true,
                name: true,
                profilePicture: true,
                status: true,
                isOnline: true,
                lastSeen: true,
            },
        });
    }

    /**
     * Find user by waId
     */
    public async findUserByWaId(waId: string) {
        return prisma.user.findUnique({
            where: { waId },
            select: {
                id: true,
                waId: true,
                name: true,
                profilePicture: true,
                status: true,
                isOnline: true,
                lastSeen: true,
            },
        });
    }

    /**
     * Check if contact already exists
     */
    public async findExistingContact(
        userId: string,
        contactUserId: string
    ): Promise<Contact | null> {
        return prisma.contact.findFirst({
            where: {
                userId,
                contactUserId,
            },
        });
    }

    /**
     * Create a new contact
     */
    public async create(data: {
        userId: string;
        contactUserId: string;
        nickname?: string;
    }): Promise<Contact> {
        return prisma.contact.create({
            data: {
                userId: data.userId,
                contactUserId: data.contactUserId,
                nickname: data.nickname,
                isBlocked: false,
            },
        });
    }

    /**
     * Search users by waId or name
     */
    public async searchUsers(query: string, excludeUserId: string, limit: number = 10) {
        return prisma.user.findMany({
            where: {
                NOT: { id: excludeUserId },
                OR: [
                    { waId: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                waId: true,
                name: true,
                profilePicture: true,
                status: true,
                isOnline: true,
            },
            take: limit,
        });
    }

    /**
     * Find existing contacts by user IDs
     */
    public async findContactsByUserIds(
        userId: string,
        contactUserIds: string[]
    ): Promise<Contact[]> {
        return prisma.contact.findMany({
            where: {
                userId,
                contactUserId: { in: contactUserIds },
            },
        });
    }
}

export default new ContactRepository();
