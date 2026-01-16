import { redis } from './redis';
import logger from './logger';

/**
 * Cache key prefixes for different data types
 */
export const CacheKeys = {
    /** Recent messages for a conversation: cache:messages:recent:{conversationId} */
    MESSAGES_RECENT: (conversationId: string) => `cache:messages:recent:${conversationId}`,

    /** Message count for a conversation: cache:messages:count:{conversationId} */
    MESSAGES_COUNT: (conversationId: string) => `cache:messages:count:${conversationId}`,

    /** Conversation metadata: cache:conversation:meta:{conversationId} */
    CONVERSATION_META: (conversationId: string) => `cache:conversation:meta:${conversationId}`,

    /** User's conversation list: cache:user:conversations:{waId} */
    USER_CONVERSATIONS: (waId: string) => `cache:user:conversations:${waId}`,

    /** User online status: cache:user:online:{waId} */
    USER_ONLINE: (waId: string) => `cache:user:online:${waId}`,

    /** Message idempotency key: cache:message:idempotency:{correlationId} */
    MESSAGE_IDEMPOTENCY: (correlationId: string) => `cache:message:idempotency:${correlationId}`,
} as const;

/**
 * Default TTL values in seconds
 */
export const CacheTTL = {
    /** 1 hour for recent messages */
    MESSAGES_RECENT: 60 * 60,

    /** 30 minutes for conversation metadata */
    CONVERSATION_META: 30 * 60,

    /** 5 minutes for user's conversation list */
    USER_CONVERSATIONS: 5 * 60,

    /** 60 seconds for online status (refresh with heartbeat) */
    USER_ONLINE: 60,

    /** 5 minutes for idempotency keys (prevent duplicates) */
    MESSAGE_IDEMPOTENCY: 5 * 60,
} as const;

/**
 * Maximum items to store in list caches
 */
export const CacheLimits = {
    /** Keep last 100 messages per conversation */
    MESSAGES_RECENT: 100,
} as const;

/**
 * Cache service for managing Redis cache operations
 */
class CacheService {
    /**
     * Get a value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const value = await redis.get(key);
            if (value === null) return null;

            // If it's already an object (Upstash auto-parses JSON), return it
            if (typeof value === 'object') return value as T;

            // Try to parse if it's a string
            try {
                return JSON.parse(value as string) as T;
            } catch {
                return value as T;
            }
        } catch (error) {
            logger.error(`Cache GET error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Set a value in cache with optional TTL
     */
    async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);

            if (ttlSeconds) {
                await redis.set(key, serialized, { ex: ttlSeconds });
            } else {
                await redis.set(key, serialized);
            }
            return true;
        } catch (error) {
            logger.error(`Cache SET error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete a key from cache
     */
    async del(key: string): Promise<boolean> {
        try {
            await redis.del(key);
            return true;
        } catch (error) {
            logger.error(`Cache DEL error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete multiple keys matching a pattern
     * Note: Pattern-based deletion should be used sparingly
     */
    async delByPattern(pattern: string): Promise<boolean> {
        try {
            // Upstash doesn't support KEYS command directly for patterns
            // For now, we'll handle this by explicit key deletion
            logger.warn(`Pattern deletion not fully supported: ${pattern}`);
            return true;
        } catch (error) {
            logger.error(`Cache DEL pattern error for ${pattern}:`, error);
            return false;
        }
    }

    /**
     * Push an item to the left of a list (newest first)
     */
    async lpush<T>(key: string, value: T): Promise<boolean> {
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            await redis.lpush(key, serialized);
            return true;
        } catch (error) {
            logger.error(`Cache LPUSH error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get a range of items from a list
     */
    async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
        try {
            const items = await redis.lrange(key, start, stop);
            return items.map((item) => {
                if (typeof item === 'object') return item as T;
                try {
                    return JSON.parse(item as string) as T;
                } catch {
                    return item as T;
                }
            });
        } catch (error) {
            logger.error(`Cache LRANGE error for key ${key}:`, error);
            return [];
        }
    }

    /**
     * Trim a list to a specific range (keep only items within range)
     */
    async ltrim(key: string, start: number, stop: number): Promise<boolean> {
        try {
            await redis.ltrim(key, start, stop);
            return true;
        } catch (error) {
            logger.error(`Cache LTRIM error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Set expiration on a key
     */
    async expire(key: string, seconds: number): Promise<boolean> {
        try {
            await redis.expire(key, seconds);
            return true;
        } catch (error) {
            logger.error(`Cache EXPIRE error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Check if a key exists
     */
    async exists(key: string): Promise<boolean> {
        try {
            const result = await redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Cache EXISTS error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Increment a numeric value
     */
    async incr(key: string): Promise<number> {
        try {
            return await redis.incr(key);
        } catch (error) {
            logger.error(`Cache INCR error for key ${key}:`, error);
            return 0;
        }
    }

    // ============================================
    // HIGH-LEVEL MESSAGE CACHING OPERATIONS
    // ============================================

    /**
     * Add a message to the recent messages cache for a conversation
     */
    async cacheRecentMessage<T>(conversationId: string, message: T): Promise<void> {
        const key = CacheKeys.MESSAGES_RECENT(conversationId);

        // Push to the front of the list (newest first)
        await this.lpush(key, message);

        // Trim to keep only the most recent messages
        await this.ltrim(key, 0, CacheLimits.MESSAGES_RECENT - 1);

        // Set/refresh expiration
        await this.expire(key, CacheTTL.MESSAGES_RECENT);
    }

    /**
     * Get recent messages from cache
     */
    async getRecentMessages<T>(conversationId: string, limit: number = 25): Promise<T[]> {
        const key = CacheKeys.MESSAGES_RECENT(conversationId);
        return this.lrange<T>(key, 0, limit - 1);
    }

    /**
     * Check if a message with the given correlation ID was already processed
     * Returns true if it's a duplicate, false if it's new
     */
    async checkIdempotency(correlationId: string): Promise<boolean> {
        if (!correlationId) return false;

        const key = CacheKeys.MESSAGE_IDEMPOTENCY(correlationId);
        const exists = await this.exists(key);

        if (exists) {
            logger.warn(`Duplicate message detected with correlationId: ${correlationId}`);
            return true;
        }

        // Mark this correlation ID as processed
        await this.set(key, Date.now(), CacheTTL.MESSAGE_IDEMPOTENCY);
        return false;
    }

    /**
     * Invalidate conversation-related caches when a message is sent
     */
    async invalidateConversationCaches(
        conversationId: string,
        participantWaIds: string[]
    ): Promise<void> {
        // Invalidate conversation metadata
        await this.del(CacheKeys.CONVERSATION_META(conversationId));

        // Invalidate each participant's conversation list
        for (const waId of participantWaIds) {
            await this.del(CacheKeys.USER_CONVERSATIONS(waId));
        }
    }
}

export const cacheService = new CacheService();
export default cacheService;
