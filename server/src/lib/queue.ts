
import { Queue } from 'bullmq';
import { Redis, RedisOptions } from 'ioredis';
import logger from '@/lib/logger';

// Queue names
export const QUEUE_NAMES = {
    CHAT_EVENTS: 'chat-events',
} as const;

// Base options required by BullMQ
const baseRedisOptions: RedisOptions = {
    maxRetriesPerRequest: null,
};

// Helper to create a new Redis connection
export const createRedisConnection = (): Redis => {
    if (process.env.REDIS_URL) {
        return new Redis(process.env.REDIS_URL, baseRedisOptions);
    }

    return new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        ...baseRedisOptions,
    });
};

// Shared connection for Queues (Producers)
// It is safe to verify this connection is ready
export const redisConnection = createRedisConnection();

redisConnection.on('error', (err) => {
    logger.error('Redis Connection Error:', err);
});

// Initialize Queues
export const chatQueue = new Queue(QUEUE_NAMES.CHAT_EVENTS, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

chatQueue.on('error', (err) => {
    logger.error('Chat Queue Error:', err);
});

logger.info(`BullMQ initialized: ${QUEUE_NAMES.CHAT_EVENTS}`);
