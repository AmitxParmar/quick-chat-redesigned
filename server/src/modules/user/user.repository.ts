import prisma from '@/lib/prisma';
import { User, Prisma } from '@prisma/client';
import { type PublicUser } from '@/types/user.type';

export class UserRepository {
    public async findAll(search?: string, userId?: User['id']): Promise<PublicUser[]> {
        const where: Prisma.UserWhereInput = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { waId: { contains: search } },
            ]
        } : {};

        if (userId) {
            where.id = {
                not: userId
            };
        }

        return prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                waId: true,
                status: true,
                profilePicture: true,
                lastSeen: true,
                isOnline: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    }
}

export default new UserRepository();
