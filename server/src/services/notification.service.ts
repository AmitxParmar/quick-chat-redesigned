import webpush from 'web-push';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

// Configure VAPID keys from environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    logger.info('[NotificationService] VAPID keys configured successfully');
} else {
    logger.warn('[NotificationService] VAPID keys not found in environment variables. Push notifications will not work.');
}

class NotificationService {
    /**
     * Send a real push notification to a user's subscribed devices.
     * 
     * @param toUserWaId - The WhatsApp ID (waId) of the recipient
     * @param title - Notification title
     * @param body - Notification body text
     */
    async sendPushNotification(toUserWaId: string, title: string, body: string): Promise<void> {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            logger.warn('[NotificationService] Skipping push: VAPID keys not configured');
            return;
        }

        try {
            // Look up the user by waId to get their userId
            const user = await prisma.user.findFirst({
                where: { waId: toUserWaId },
                select: { id: true }
            });

            if (!user) {
                logger.info(`[NotificationService] No user found for waId ${toUserWaId}`);
                return;
            }

            // Fetch all push subscriptions for this user
            const subscriptions = await prisma.pushSubscription.findMany({
                where: { userId: user.id }
            });

            if (subscriptions.length === 0) {
                logger.info(`[NotificationService] No push subscriptions found for user ${toUserWaId}`);
                return;
            }

            const payload = JSON.stringify({
                title,
                body,
                icon: '/icon.png',
                data: {
                    url: '/'
                }
            });

            logger.info(`[NotificationService] Sending push to ${subscriptions.length} device(s) for user ${toUserWaId}`);

            const results = await Promise.allSettled(
                subscriptions.map(async (sub) => {
                    try {
                        // The subscription object stored in DB has endpoint + keys
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: sub.keys as { p256dh: string; auth: string }
                        };

                        await webpush.sendNotification(pushSubscription, payload);
                        logger.info(`[NotificationService] Push sent to endpoint: ${sub.endpoint.slice(0, 50)}...`);
                    } catch (error: any) {
                        // Handle expired/invalid subscriptions
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            logger.info(`[NotificationService] Removing expired subscription ${sub.id}`);
                            await prisma.pushSubscription.delete({ where: { id: sub.id } });
                        } else {
                            logger.error(`[NotificationService] Failed to send push to ${sub.endpoint.slice(0, 50)}:`, error.message || error);
                        }
                    }
                })
            );

            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            logger.info(`[NotificationService] Push notification sent to ${toUserWaId}: "${title}" (${succeeded}/${subscriptions.length} devices)`);
        } catch (error) {
            logger.error(`[NotificationService] Error sending push notification:`, error);
        }
    }
}

export const notificationService = new NotificationService();
