import contactRepository, {
    type PopulatedContact,
    type UserSearchResult,
} from './contact.repository';
import { HttpBadRequestError, HttpNotFoundError } from '@/lib/errors';
import logger from '@/lib/logger';

/**
 * Normalize WhatsApp ID (add 91 prefix if missing)
 */
const normalizeWaId = (waId: string): string => {
    return waId?.startsWith('91') ? waId.trim() : `91${waId?.trim()}`;
};

export default class ContactService {
    /**
     * Get contacts grouped by initial letter
     */
    public async getContacts(
        userId: string
    ): Promise<Record<string, PopulatedContact[]>> {
        // Get all contacts for user
        const contacts = await contactRepository.findByUserId(userId);

        // Populate user data for each contact
        const transformedContacts: PopulatedContact[] = [];

        for (const contact of contacts) {
            const contactUser = await contactRepository.findUserById(
                contact.contactUserId
            );

            if (contactUser) {
                transformedContacts.push({
                    id: contact.id,
                    waId: contactUser.waId,
                    name: contact.nickname || contactUser.name,
                    profilePicture: contactUser.profilePicture,
                    status: contactUser.status,
                    isOnline: contactUser.isOnline,
                    lastSeen: contactUser.lastSeen,
                    nickname: contact.nickname,
                });
            }
        }

        // Sort by name
        transformedContacts.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
        });

        // Group by initial letter
        const groupedContacts: Record<string, PopulatedContact[]> = {};

        transformedContacts.forEach((contact) => {
            let initial: string =
                contact.name && typeof contact.name === 'string'
                    ? contact.name.charAt(0).toUpperCase()
                    : '#';

            if (!/^[A-Z]$/.test(initial)) {
                initial = '#';
            }

            if (!groupedContacts[initial]) {
                groupedContacts[initial] = [];
            }

            groupedContacts[initial]!.push(contact);
        });

        // Sort the keys
        const sortedGroupedContacts: Record<string, PopulatedContact[]> = {};
        Object.keys(groupedContacts)
            .sort((a, b) => {
                if (a === '#') return 1;
                if (b === '#') return -1;
                return a.localeCompare(b);
            })
            .forEach((key) => {
                sortedGroupedContacts[key] = groupedContacts[key] || [];
            });

        logger.info(
            `[getContacts] Found ${transformedContacts.length} contacts for user ${userId}`
        );

        return sortedGroupedContacts;
    }

    /**
     * Add a new contact
     */
    public async addContact(
        userId: string,
        waId: string,
        nickname?: string
    ): Promise<any> {
        if (!waId) {
            throw new HttpBadRequestError('WhatsApp ID is required', [
                'WhatsApp ID is required',
            ]);
        }

        // Normalize waId
        const normalizedWaId = normalizeWaId(waId);

        // Find the user to add as contact
        const contactUser = await contactRepository.findUserByWaId(normalizedWaId);

        if (!contactUser) {
            throw new HttpNotFoundError('User not found');
        }

        // Prevent adding self
        if (contactUser.id === userId) {
            throw new HttpBadRequestError('Cannot add yourself as a contact', [
                'Cannot add yourself as a contact',
            ]);
        }

        // Check if contact already exists
        const existingContact = await contactRepository.findExistingContact(
            userId,
            contactUser.id
        );

        if (existingContact) {
            throw new HttpBadRequestError('Contact already exists', [
                'Contact already exists',
            ]);
        }

        // Create new contact
        const newContact = await contactRepository.create({
            userId,
            contactUserId: contactUser.id,
            nickname,
        });

        logger.info(
            `[addContact] User ${userId} added contact ${contactUser.waId} (${contactUser.id})`
        );

        // Return populated contact
        return {
            id: newContact.id,
            userId: newContact.userId,
            contactUserId: newContact.contactUserId,
            nickname: newContact.nickname,
            contactUser: {
                waId: contactUser.waId,
                name: contactUser.name,
                profilePicture: contactUser.profilePicture,
                status: contactUser.status,
                isOnline: contactUser.isOnline,
                lastSeen: contactUser.lastSeen,
            },
        };
    }

    /**
     * Search users by waId or name
     */
    public async searchUsers(
        userId: string,
        query: string
    ): Promise<UserSearchResult[]> {
        if (!query || typeof query !== 'string') {
            throw new HttpBadRequestError('Search query is required', [
                'Search query is required',
            ]);
        }

        // Search users
        const users = await contactRepository.searchUsers(query, userId, 10);

        // Check which users are already contacts
        const userIds = users.map((u) => u.id);
        const existingContacts = await contactRepository.findContactsByUserIds(
            userId,
            userIds
        );

        const existingContactIds = new Set(
            existingContacts.map((c) => c.contactUserId)
        );

        // Map to search results
        const searchResults: UserSearchResult[] = users.map((user) => ({
            id: user.id,
            waId: user.waId,
            name: user.name,
            profilePicture: user.profilePicture,
            status: user.status,
            isOnline: user.isOnline,
            isContact: existingContactIds.has(user.id),
        }));

        logger.info(
            `[searchUsers] Found ${searchResults.length} users for query "${query}"`
        );

        return searchResults;
    }
}
