import { type NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import NotificationService from './notification.service';
import { type CustomResponse } from '@/types/common.type';
import { type AuthRequest } from '@/types/auth.type';
import Api from '@/lib/api';
import { type Notification } from '@prisma/client';

export default class NotificationController extends Api {
    private readonly notificationService = new NotificationService();

    /**
     * GET /notifications
     */
    public getMyNotifications = async (
        req: AuthRequest,
        res: CustomResponse<Notification[]>,
        next: NextFunction
    ) => {
        try {
            const notifications = await this.notificationService.getMyNotifications(req.user!.id);
            this.send(res, notifications, HttpStatusCode.Ok, 'Notifications retrieved successfully');
        } catch (e) {
            next(e);
        }
    };

    /**
     * GET /notifications/unread-count
     */
    public getUnreadCount = async (
        req: AuthRequest,
        res: CustomResponse<{ count: number }>,
        next: NextFunction
    ) => {
        try {
            const count = await this.notificationService.getUnreadCount(req.user!.id);
            this.send(res, count, HttpStatusCode.Ok, 'Unread count retrieved successfully');
        } catch (e) {
            next(e);
        }
    };

    /**
     * PATCH /notifications/:id/read
     */
    public markAsRead = async (
        req: AuthRequest,
        res: CustomResponse<Notification>,
        next: NextFunction
    ) => {
        try {
            const notification = await this.notificationService.markAsRead(req.params.id, req.user!.id);
            this.send(res, notification, HttpStatusCode.Ok, 'Notification marked as read');
        } catch (e) {
            next(e);
        }
    };

    /**
     * PATCH /notifications/read-all
     */
    public markAllAsRead = async (
        req: AuthRequest,
        res: CustomResponse<null>,
        next: NextFunction
    ) => {
        try {
            await this.notificationService.markAllAsRead(req.user!.id);
            this.send(res, null, HttpStatusCode.Ok, 'All notifications marked as read');
        } catch (e) {
            next(e);
        }
    };
}
