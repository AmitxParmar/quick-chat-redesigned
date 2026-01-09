
import prisma from '@/lib/prisma';
import { User, Prisma } from '@prisma/client';

export class UserRepository {
    /**
     * Finds all users
     */
    public async findAll(search?: string, userId?: User['id']): Promise<Omit<User, 'passwordHash'>[]> {
        const where: Prisma.UserWhereInput = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } }
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
                email: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    }
}

export default new UserRepository();
