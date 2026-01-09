import { Router } from 'express';
import Controller from './contact.controller';
import { verifyAuthToken } from '@/middlewares/auth';

const contact: Router = Router();
const controller = new Controller();

/**
 * GET /contacts
 * @summary Get all contacts grouped by initial letter
 * @tags contacts
 * @security bearerAuth
 * @return {object} 200 - Contacts grouped by initial letter (A-Z, #)
 */
contact.get('/', verifyAuthToken, controller.getContacts);

/**
 * GET /contacts/search
 * @summary Search for users by waId or name
 * @tags contacts
 * @security bearerAuth
 * @param {string} query.query.required - Search query
 * @return {array<object>} 200 - Search results with isContact flag
 */
contact.get('/search', verifyAuthToken, controller.searchUsers);

/**
 * POST /contacts
 * @summary Add a new contact
 * @tags contacts
 * @security bearerAuth
 * @param {object} request.body.required - Contact details
 * @param {string} request.body.waId.required - WhatsApp ID of user to add
 * @param {string} request.body.nickname - Optional nickname for the contact
 * @return {object} 201 - Contact added successfully
 */
contact.post('/', verifyAuthToken, controller.addContact);

export default contact;
