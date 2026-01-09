import { Router } from 'express';
import Controller from './conversation.controller';
import { verifyAuthToken } from '@/middlewares/auth';

const conversation: Router = Router();
const controller = new Controller();

/**
 * POST /conversations
 * @summary Get or create conversation ID for two participants
 * @tags conversations
 * @security bearerAuth
 * @param {object} request.body.required - Conversation participants
 * @param {string} request.body.to.required - Recipient's WhatsApp ID
 * @return {object} 200 - Existing conversation found
 * @return {object} 201 - New conversation created
 */
conversation.post('/', verifyAuthToken, controller.getConversationId);

/**
 * GET /conversations
 * @summary Get all conversations for authenticated user
 * @tags conversations
 * @security bearerAuth
 * @return {array<object>} 200 - List of conversations
 */
conversation.get('/', verifyAuthToken, controller.getConversations);

/**
 * PUT /conversations/:conversationId/read
 * @summary Mark all messages in conversation as read
 * @tags conversations
 * @security bearerAuth
 * @param {string} conversationId.path.required - Conversation ID
 * @return {object} 200 - Messages marked as read successfully
 */
conversation.put('/:conversationId/read', verifyAuthToken, controller.markAsRead);

/**
 * DELETE /conversations/:conversationId
 * @summary Delete or archive conversation
 * @tags conversations
 * @security bearerAuth
 * @param {string} conversationId.path.required - Conversation ID
 * @param {string} deleteType.query - Delete type: 'soft' (default) or 'hard'
 * @return {object} 200 - Conversation deleted successfully
 */
conversation.delete('/:conversationId', verifyAuthToken, controller.deleteConversation);

export default conversation;
