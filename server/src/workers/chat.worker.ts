
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from '@/lib/queue';
import logger from '@/lib/logger';
import { notificationService } from '@/services/notification.service';
import { analyticsService } from '@/services/analytics.service';

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
                const msg = payload.message;
                // 1. Send Push Notification to recipient
                // We only send if the user is not in the active chat (handled by client status usually, 
                // but for simplicity we send 'data' messages that client handles)
                await notificationService.sendPushNotification(
                    msg.to,
                    `New message from ${msg.contact?.name || msg.from}`,
                    msg.text
                );

                // 2. Track Analytics
                await analyticsService.trackEvent('message_sent', {
                    messageId: msg.id,
                    senderId: msg.from,
                    type: msg.type,
                    timestamp: Date.now()
                });

                logger.info(`New message processed: ${msg.id}`);
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
