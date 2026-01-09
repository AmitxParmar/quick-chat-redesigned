import { type NextFunction, type Request } from 'express';
import { HttpStatusCode } from 'axios';
import ConversationService from './conversation.service';
import { type CustomResponse } from '@/types/common.type';
import { type AuthRequest } from '@/types/auth.type';
import Api from '@/lib/api';
import { type Conversation } from '@prisma/client';

/**
 * Response type for getConversationId
 */
interface ConversationIdResponse {
    id: string;
    conversationId: string;
    isNew: boolean;
}

/**
 * Response type for markAsRead
 */
interface MarkAsReadResponse {
    lastMessageStatusUpdated: boolean;
    lastMessageBefore: any;
    lastMessageAfter: any;
    affectedMessagesCount: number;
}

/**
 * Response type for deleteConversation
 */
interface DeleteConversationResponse {
    conversationId: string;
    deleteType: string;
    deletedAt: Date;
    conversation?: Conversation;
}

export default class ConversationController extends Api {
    private readonly conversationService = new ConversationService();

    /**
     * POST /conversations - Get or create conversation ID
     */
    public getConversationId = async (
        req: AuthRequest,
        res: CustomResponse<ConversationIdResponse | null>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const { to } = req.body;

            if (!to) {
                return res.status(HttpStatusCode.BadRequest).json({
                    message: "'to' field is required",
                    data: null,
                });
            }

            if (typeof to !== 'string') {
                return res.status(HttpStatusCode.BadRequest).json({
                    message: "'to' must be a string",
                    data: null,
                });
            }

            const result = await this.conversationService.getConversationId(
                req.user.waId,
                to
            );

            this.send(
                res,
                result,
                result.isNew ? HttpStatusCode.Created : HttpStatusCode.Ok,
                result.isNew ? 'Conversation created' : 'Conversation found'
            );
        } catch (e) {
            next(e);
        }
    };

    /**
     * GET /conversations - Get all conversations for authenticated user
     */
    public getConversations = async (
        req: AuthRequest,
        res: CustomResponse<Conversation[] | null>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const conversations = await this.conversationService.getConversations(
                req.user.waId
            );

            this.send(
                res,
                conversations,
                HttpStatusCode.Ok,
                'Conversations retrieved successfully'
            );
        } catch (e) {
            next(e);
        }
    };

    /**
     * PUT /conversations/:conversationId/read - Mark conversation as read
     */
    public markAsRead = async (
        req: AuthRequest,
        res: CustomResponse<MarkAsReadResponse | null>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const { conversationId } = req.params;

            if (!conversationId) {
                return res.status(HttpStatusCode.BadRequest).json({
                    message: 'Conversation ID is required',
                    data: null,
                });
            }

            const result = await this.conversationService.markAsRead(
                conversationId,
                req.user.waId
            );

            this.send(
                res,
                result,
                HttpStatusCode.Ok,
                'Messages marked as read'
            );
        } catch (e) {
            next(e);
        }
    };

    /**
     * DELETE /conversations/:conversationId - Delete conversation
     */
    public deleteConversation = async (
        req: AuthRequest,
        res: CustomResponse<DeleteConversationResponse | null>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const { conversationId } = req.params;
            const { deleteType } = req.query;

            if (!conversationId) {
                return res.status(HttpStatusCode.BadRequest).json({
                    message: 'Conversation ID is required',
                    data: null,
                });
            }

            // Validate deleteType
            if (deleteType && deleteType !== 'soft' && deleteType !== 'hard') {
                return res.status(HttpStatusCode.BadRequest).json({
                    message: "Invalid delete type. Must be 'soft' or 'hard'",
                    data: null,
                });
            }

            const result = await this.conversationService.deleteConversation(
                conversationId,
                req.user.waId,
                (deleteType as 'soft' | 'hard') || 'soft'
            );

            const message =
                result.deleteType === 'soft'
                    ? 'Conversation archived successfully'
                    : 'Conversation and all messages deleted permanently';

            this.send(res, result, HttpStatusCode.Ok, message);
        } catch (e) {
            next(e);
        }
    };
}
