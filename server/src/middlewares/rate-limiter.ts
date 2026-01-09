import rateLimit from 'express-rate-limit';
import environment from '@/lib/environment';

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
