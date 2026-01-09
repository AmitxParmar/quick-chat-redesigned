import { Router } from 'express';
import Controller from './notification.controller';
import { verifyAuthToken } from '@/middlewares/auth';

const notification: Router = Router();
const controller = new Controller();

// All notification routes require authentication
notification.use(verifyAuthToken);

/**
 * Notification object
 * @typedef {object} Notification
 * @property {string} id - Notification ID
 * @property {string} userId - User ID
 * @property {string} taskId - Related Task ID
 * @property {string} type - Notification Type (TASK_ASSIGNED)
 * @property {string} message - Notification Message
 * @property {boolean} isRead - Is read status
 * @property {string} createdAt - Creation timestamp
 */

/**
 * GET /notifications
 * @summary Get all user notifications
 * @tags notifications
 * @security bearerAuth
 * @return {array<Notification>} 200 - List of notifications
 */
notification.get('/', controller.getMyNotifications);

/**
 * GET /notifications/unread-count
 * @summary Get count of unread notifications
 * @tags notifications
 * @security bearerAuth
 * @return {object} 200 - { count: number }
 */
notification.get('/unread-count', controller.getUnreadCount);

/**
 * PATCH /notifications/:id/read
 * @summary Mark a notification as read
 * @tags notifications
 * @security bearerAuth
 * @param {string} id.path.required - Notification ID
 * @return {Notification} 200 - Updated notification
 */
notification.patch('/:id/read', controller.markAsRead);

/**
 * PATCH /notifications/read-all
 * @summary Mark all notifications as read
 * @tags notifications
 * @security bearerAuth
 * @return {object} 200 - Success message
 */
notification.patch('/read-all', controller.markAllAsRead);

export default notification;
