import { type Notification } from '@prisma/client';
import notificationRepository from './notification.repository';
import socketService from '@/lib/socket';
import logger from '@/lib/logger';
import { HttpNotFoundError } from '@/lib/errors';

export default class NotificationService {
    /**
     * Get all notifications for a user
     */
    public async getMyNotifications(userId: string): Promise<Notification[]> {
        return notificationRepository.findAll(userId);
    }

    /**
     * Get unread count for a user
     */
    public async getUnreadCount(userId: string): Promise<{ count: number }> {
        const count = await notificationRepository.countUnread(userId);
        return { count };
    }

    /**
     * Mark a notification as read
     */
    public async markAsRead(id: string, userId: string): Promise<Notification> {
        try {
            return await notificationRepository.markAsRead(id, userId);
        } catch (error) {
            throw new HttpNotFoundError('Notification not found or access denied');
        }
    }

    /**
     * Mark all notifications as read
     */
    public async markAllAsRead(userId: string): Promise<void> {
        await notificationRepository.markAllAsRead(userId);
    }

    /**
     * Create a notification for task assignment and emit event
     */
    public async createTaskAssignmentNotification(
        taskId: string,
        assigneeId: string,
        taskTitle: string,
        task: unknown
    ): Promise<void> {
        try {
            const message = `You have been assigned to task: ${taskTitle}`;

            // 1. Persist to DB
            const notification = await notificationRepository.create({
                userId: assigneeId,
                taskId,
                type: 'TASK_ASSIGNED',
                message,
            });

            // 2. Emit Real-time Notification
            socketService.sendNotificationToUser(assigneeId, {
                id: notification.id,
                type: notification.type,
                message: notification.message,
                taskId: notification.taskId,
                createdAt: notification.createdAt,
            });

            // 3. Emit Task Assigned Event (specific event for strict typing on client if needed)
            socketService.notifyTaskAssigned(assigneeId, {
                taskId,
                task,
                newAssigneeId: assigneeId,
                // We can attach the notification object if the client needs it immediately
            });

            logger.info(`Notification created for user ${assigneeId} on task ${taskId}`);
        } catch (error) {
            logger.error('Failed to create notification', error);
            // We don't throw here to avoid blocking the main task operation
        }
    }
}
