import prisma from '@/lib/prisma';
import { type Notification } from '@prisma/client';

export class NotificationRepository {
    /**
     * Creates a new notification
     */
    public async create(data: {
        userId: string;
        taskId: string;
        type: 'TASK_ASSIGNED';
        message: string;
    }): Promise<Notification> {
        return prisma.notification.create({
            data: {
                ...data,
                type: data.type,
            },
        });
    }

    /**
     * Finds all notifications for a user
     */
    public async findAll(userId: string): Promise<Notification[]> {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                task: {
                    select: {
                        title: true,
                    },
                },
            },
        });
    }

    /**
     * Counts unread notifications for a user
     */
    public async countUnread(userId: string): Promise<number> {
        return prisma.notification.count({
            where: {
                userId,
                isRead: false,
            },
        });
    }

    /**
     * Marks a notification as read
     */
    public async markAsRead(id: string, userId: string): Promise<Notification> {
        return prisma.notification.update({
            where: {
                id,
                userId, // Security check: Ensure notification belongs to user
            },
            data: { isRead: true },
        });
    }

    /**
     * Marks all notifications as read for a user
     */
    public async markAllAsRead(userId: string): Promise<void> {
        await prisma.notification.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: { isRead: true },
        });
    }
}

export default new NotificationRepository();
