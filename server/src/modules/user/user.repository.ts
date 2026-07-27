import prisma from '@/lib/prisma';
import { User, Prisma } from '@prisma/client';

export class UserRepository {
    public async findAll(search?: string, userId?: User['id']): Promise<Omit<User, 'password'>[]> {
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
                refreshToken: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    }
}

export default new UserRepository();
