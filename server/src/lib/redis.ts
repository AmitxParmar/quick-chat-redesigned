import { Redis } from '@upstash/redis';
import { config } from 'dotenv';
import logger from './logger';

config();

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logger.warn('Redis credentials not found in environment variables. Auth sessions will fail.');
}

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
