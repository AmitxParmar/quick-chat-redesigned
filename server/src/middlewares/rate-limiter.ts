import rateLimit from 'express-rate-limit';
import environment from '@/lib/environment';
import { type AuthRequest } from '@/types/auth.type';

/**
 * General API Rate Limiter
 * limit each IP to 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        status: 429,
        message: "Too many requests from this IP, please try again after 15 minutes"
    },
    // Skip rate limiting in development if needed, or keep it to test
    skip: (req) => environment.isDev() && false // currently not skipping to allow testing
});

/**
 * Message Rate Limiter
 * Limits message sending per user (by waId) instead of IP
 * 60 messages per minute per user
 */
export const messageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 60, // 60 messages per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user's waId for rate limiting (authenticated users only)
        const authReq = req as AuthRequest;
        // Return waId if available, otherwise use 'anonymous' (IP-based limiting is disabled)
        return authReq.user?.waId || 'anonymous';
    },
    message: {
        status: 429,
        message: "You're sending messages too fast! Please slow down.",
    },
    skip: () => false, // Always enforce, even in dev
    // Disable default validations since we're using waId, not IP
    validate: { default: false },
});

/**
 * Search Rate Limiter
 * Limits search requests per user (more restrictive as search is expensive)
 * 30 searches per minute per user
 */
export const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 30, // 30 searches per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as AuthRequest;
        return authReq.user?.waId || 'anonymous';
    },
    message: {
        status: 429,
        message: "Too many search requests. Please try again in a moment.",
    },
    skip: () => false,
    // Disable default validations since we're using waId, not IP
    validate: { default: false },
});
