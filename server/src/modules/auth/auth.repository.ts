import { type User } from '@prisma/client';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * Repository for auth operations with WhatsApp ID-based authentication
 */
export class AuthRepository {
    /**
     * Find user by WhatsApp ID
     */
    public async findUserByWaId(waId: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { waId },
        });
    }

    /**
     * Find user by ID
     */
    public async findUserById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    /**
     * Create user with WhatsApp ID
     */
    public async createUser(data: {
        waId: string;
        name?: string;
        password: string;
        profilePicture?: string;
    }): Promise<User> {
        const passwordHash = await bcrypt.hash(data.password, 12);

        return prisma.user.create({
            data: {
                waId: data.waId,
                name: data.name || `User ${data.waId}`,
                password: passwordHash,
                profilePicture: data.profilePicture,
                isOnline: true,
            },
        });
    }

    /**
     * Update user
     */
    public async updateUser(
        id: string,
        data: {
            name?: string;
            profilePicture?: string;
            status?: string;
            isOnline?: boolean;
            lastSeen?: Date;
            refreshToken?: string | null;
        }
    ): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        });
    }

    /**
     * Update password
     */
    public async updatePassword(id: string, newPassword: string): Promise<void> {
        const passwordHash = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id },
            data: { password: passwordHash },
        });
    }

    /**
     * Compare password
     */
    public async comparePassword(
        user: User,
        candidatePassword: string
    ): Promise<boolean> {
        return bcrypt.compare(candidatePassword, user.password);
    }
}

export default new AuthRepository();
