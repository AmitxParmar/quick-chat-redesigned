import { type NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import MessageService from './message.service';
import { type CustomResponse } from '@/types/common.type';
import { type AuthRequest } from '@/types/auth.type';
import Api from '@/lib/api';

/**
 * Controller for message-related HTTP endpoints
 */
export default class MessageController extends Api {
    private readonly messageService = new MessageService();

    /**
     * GET /:conversationId - Get all messages in a conversation
     */
    public getMessages = async (
        req: AuthRequest,
        res: CustomResponse<any>,
        next: NextFunction
    ) => {
        try {
            const { conversationId } = req.params;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 25;

            const result = await this.messageService.getMessages(
                conversationId,
                { page, limit },
                {
                    userWaId: req.user!.waId,
                }
            );

            this.send(res, result, HttpStatusCode.Ok, 'Messages retrieved successfully');
        } catch (e) {
            next(e);
        }
    };

    /**
     * GET /search - Search messages
     */
    public searchMessages = async (
        req: AuthRequest,
        res: CustomResponse<any>,
        next: NextFunction
    ) => {
        try {
            const { query, conversationId } = req.query;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 25;

            const result = await this.messageService.searchMessages(
                {
                    query: query as string,
                    conversationId: conversationId as string | undefined,
                    page,
                    limit,
                },
                {
                    userWaId: req.user!.waId,
                }
            );

            this.send(res, result, HttpStatusCode.Ok, 'Search results retrieved successfully');
        } catch (e) {
            next(e);
        }
    };

    /**
     * POST / - Send a new message
     */
    public sendMessage = async (
        req: AuthRequest,
        res: CustomResponse<any>,
        next: NextFunction
    ) => {
        try {
            const { to, text, type } = req.body;

            const result = await this.messageService.sendMessage(
                { to, text, type },
                {
                    userWaId: req.user!.waId,
                }
            );

            this.send(res, result, HttpStatusCode.Created, 'Message sent successfully');
        } catch (e) {
            next(e);
        }
    };

    /**
     * PUT /:messageId/status - Update message status
     */
    public updateMessageStatus = async (
        req: AuthRequest,
        res: CustomResponse<any>,
        next: NextFunction
    ) => {
        try {
            const { messageId } = req.params;
            const { status } = req.body;

            const message = await this.messageService.updateMessageStatus(
                messageId,
                status,
                {
                    userWaId: req.user!.waId,
                }
            );

            this.send(
                res,
                { message, status: message.status },
                HttpStatusCode.Ok,
                'Message status updated successfully'
            );
        } catch (e) {
            next(e);
        }
    };
}
