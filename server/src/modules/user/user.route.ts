
import { Router } from 'express';
import Controller from './user.controller';
import { verifyAuthToken } from '@/middlewares/auth';

const user: Router = Router();
const controller = new Controller();

/**
 * GET /users
 * @summary Get all users
 * @tags users
 * @security bearerAuth
 * @return {array<User>} 200 - List of users
 */
user.get('/', verifyAuthToken, controller.getAllUsers);

export default user;
