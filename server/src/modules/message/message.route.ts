import { Router } from 'express';
import Controller from './message.controller';
import { verifyAuthToken } from '@/middlewares/auth';
import RequestValidator from '@/middlewares/request-validator';
import { messageLimiter, searchLimiter } from '@/middlewares/rate-limiter';
import { SendMessageDto, UpdateMessageStatusDto, SearchMessagesDto } from '@/dto/message.dto';

const message: Router = Router();
const controller = new Controller();

// All message routes require authentication
message.use(verifyAuthToken);

/**
 * Message object
 * @typedef {object} Message
 * @property {string} id - Message ID
 * @property {string} conversationId - Conversation ID
 * @property {string} from - Sender waId
 * @property {string} to - Receiver waId
 * @property {string} text - Message content
 * @property {number} timestamp - Message timestamp
 * @property {string} status - Message status (sent, delivered, read, failed)
 * @property {string} type - Message type (text, image, document, audio, video)
 * @property {string} waId - WhatsApp ID
 * @property {string} direction - Message direction (incoming, outgoing)
 * @property {object} contact - Contact information
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Update timestamp
 */

/**
 * Send message body
 * @typedef {object} SendMessageBody
 * @property {string} to.required - Receiver waId
 * @property {string} text.required - Message content (max 4000 chars)
 * @property {string} type - Message type (default: text)
 * @property {string} correlationId - Idempotency key to prevent duplicates
 */

/**
 * Update status body
 * @typedef {object} UpdateStatusBody
 * @property {string} status.required - New status (sent, delivered, read)
 */

/**
 * GET /messages/search
 * @summary Search messages across conversations
 * @tags messages
 * @security bearerAuth
 * @param {string} query.query.required - Search query text (max 200 chars)
 * @param {string} conversationId.query - Filter by conversation ID (optional)
 * @param {string} page.query - Page number (default: 1)
 * @param {string} limit.query - Results per page (default: 25, max: 100)
 * @return {object} 200 - Search results with pagination
 */
message.get('/search', searchLimiter, controller.searchMessages);

/**
 * GET /messages/:conversationId
 * @summary Get all messages in a conversation
 * @tags messages
 * @security bearerAuth
 * @param {string} conversationId.path.required - Conversation ID
 * @param {string} page.query - Page number (default: 1)
 * @param {string} limit.query - Messages per page (default: 25, max: 100)
 * @return {object} 200 - Messages with pagination
 */
message.get('/:conversationId', controller.getMessages);

/**
 * POST /messages
 * @summary Send a new message
 * @tags messages
 * @security bearerAuth
 * @param {SendMessageBody} request.body.required
 * @return {object} 201 - Message sent successfully
 */
message.post(
    '/',
    messageLimiter,
    RequestValidator.validate(SendMessageDto),
    controller.sendMessage
);

/**
 * PUT /messages/:messageId/status
 * @summary Update message delivery status
 * @tags messages
 * @security bearerAuth
 * @param {string} messageId.path.required - Message ID
 * @param {UpdateStatusBody} request.body.required
 * @return {object} 200 - Status updated successfully
 */
message.put(
    '/:messageId/status',
    RequestValidator.validate(UpdateMessageStatusDto),
    controller.updateMessageStatus
);

export default message;

