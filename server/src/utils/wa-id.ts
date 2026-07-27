/**
 * Normalize WhatsApp ID: ensure it starts with '91' prefix and trim whitespace.
 */
export const normalizeWaId = (waId: string): string => {
    if (!waId) return waId;
    const trimmed = waId.trim();
    return trimmed.startsWith('91') ? trimmed : `91${trimmed}`;
};
