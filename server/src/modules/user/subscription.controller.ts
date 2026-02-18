import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/auth.type';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

class SubscriptionController {
    public subscribe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.id;
            const subscription = req.body;

            if (!subscription || !subscription.endpoint || !subscription.keys) {
                res.status(400).json({ message: 'Invalid subscription payload' });
                return;
            }

            // Check if subscription already exists to avoid duplicates (deduplication based on endpoint)
            const existing = await prisma.pushSubscription.findFirst({
                where: {
                    endpoint: subscription.endpoint,
                    userId // Ensure it belongs to the same user
                }
            });

            if (existing) {
                // Update keys if they changed (unlikely but possible)
                await prisma.pushSubscription.update({
                    where: { id: existing.id },
                    data: {
                        keys: subscription.keys,
                        updatedAt: new Date()
                    }
                });
            } else {
                await prisma.pushSubscription.create({
                    data: {
                        userId,
                        endpoint: subscription.endpoint,
                        keys: subscription.keys,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });
            }

            res.status(201).json({ message: 'Subscription added successfully' });
        } catch (error) {
            next(error);
        }
    };

    public unsubscribe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { endpoint } = req.body;
            if (!endpoint) {
                res.status(400).json({ message: 'Endpoint required' });
                return;
            }

            await prisma.pushSubscription.deleteMany({
                where: { endpoint }
            });

            res.status(200).json({ message: 'Unsubscribed successfully' });
        } catch (error) {
            next(error);
        }
    }
}

export default new SubscriptionController();
