import { type NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import ContactService from './contact.service';
import { type CustomResponse } from '@/types/common.type';
import { type AuthRequest } from '@/types/auth.type';
import Api from '@/lib/api';
import { type PopulatedContact, type UserSearchResult } from './contact.repository';

export default class ContactController extends Api {
    private readonly contactService = new ContactService();

    /**
     * GET /contacts - Get all contacts grouped by initial letter
     */
    public getContacts = async (
        req: AuthRequest,
        res: CustomResponse<Record<string, PopulatedContact[]> | null>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const contacts = await this.contactService.getContacts(req.user.id);

            this.send(res, contacts, HttpStatusCode.Ok, 'Contacts retrieved successfully');
        } catch (e) {
            next(e);
        }
    };

    /**
     * POST /contacts - Add a new contact
     */
    public addContact = async (
        req: AuthRequest,
        res: CustomResponse<any>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const { waId, nickname } = req.body;
            console.log(`[ContactController] User ${req.user.waId} (${req.user.id}) Requesting to add contact: ${waId}`);

            const contact = await this.contactService.addContact(
                req.user.id,
                waId,
                nickname
            );

            this.send(
                res,
                contact,
                HttpStatusCode.Created,
                'Contact added successfully'
            );
        } catch (e) {
            next(e);
        }
    };

    /**
     * GET /contacts/search - Search users
     */
    public searchUsers = async (
        req: AuthRequest,
        res: CustomResponse<UserSearchResult[] | null>,
        next: NextFunction
    ) => {
        try {
            if (!req.user) {
                return res.status(HttpStatusCode.Unauthorized).json({
                    message: 'User not authenticated',
                    data: null,
                });
            }

            const { query } = req.query;

            const results = await this.contactService.searchUsers(
                req.user.id,
                query as string
            );

            this.send(res, results, HttpStatusCode.Ok, 'Users found');
        } catch (e) {
            next(e);
        }
    };
}
