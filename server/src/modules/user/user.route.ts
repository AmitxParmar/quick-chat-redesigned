
import { Router } from 'express';
import Controller from './user.controller';
import { verifyAuthToken } from '@/middlewares/auth';

const user: Router = Router();
const controller = new Controller();

import subscriptionController from './subscription.controller';

/**
 * GET /users
 * @summary Get all users
 * @tags users
 * @security bearerAuth
 * @return {array<User>} 200 - List of users
 */
user.get('/', verifyAuthToken, controller.getAllUsers);

/**
 * POST /users/subscribe
 * @summary Subscribe to push notifications
 * @tags users
 * @security bearerAuth
 */
user.post('/subscribe', verifyAuthToken, subscriptionController.subscribe);

/**
 * POST /users/unsubscribe
 * @summary Unsubscribe from push notifications
 * @tags users
 * @security bearerAuth
 */
user.post('/unsubscribe', verifyAuthToken, subscriptionController.unsubscribe);

export default user;
