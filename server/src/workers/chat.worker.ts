
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from '@/lib/queue';
import logger from '@/lib/logger';

// Job interface
interface ChatJobData {
    type: 'new_message' | 'message_status';
    payload: any;
}

// Worker processor
const processor = async (job: Job<ChatJobData>) => {
    const { type, payload } = job.data;

    logger.info(`Processing job ${job.id} of type ${type}`);

    try {
        switch (type) {
            case 'new_message':
                // TODO: Implement Push Notifications (FCM/OneSignal)
                // TODO: Implement Analytics logging
                // For now, just log the event
                logger.info(`New message processed: ${payload.message.id}`);
                break;

            case 'message_status':
                logger.info(`Message status update processed: ${payload.id} -> ${payload.status}`);
                break;

            default:
                logger.warn(`Unknown job type: ${type}`);
        }
    } catch (error) {
        logger.error(`Failed to process job ${job.id}:`, error);
        throw error;
    }
};

// Initialize Worker
export const chatWorker = new Worker(QUEUE_NAMES.CHAT_EVENTS, processor, {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
        max: 1000,
        duration: 5000,
    },
});

chatWorker.on('completed', (job) => {
    logger.debug(`Job ${job.id} completed`);
});

chatWorker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed with error: ${err.message}`);
});

logger.info(`Chat Worker initialized for queue: ${QUEUE_NAMES.CHAT_EVENTS}`);
