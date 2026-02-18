"use client";

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const usePushNotifications = () => {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            // Register Service Worker
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });

            setPermission(Notification.permission);

            // Check if already subscribed
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(sub => {
                    if (sub) {
                        setSubscription(sub);
                        setIsSubscribed(true);
                    }
                });
            });
        }
    }, []);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const subscribeToPush = useCallback(async () => {
        if (!PUBLIC_VAPID_KEY) {
            console.error('VAPID public key not found');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check for existing subscription
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                console.log('[usePushNotifications] Found existing subscription, unsubscribing to ensure fresh key...');
                await existingSub.unsubscribe();
            }

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });

            console.log('[usePushNotifications] Subscription object:', sub);

            setSubscription(sub);
            setIsSubscribed(true);
            setPermission(Notification.permission);

            // Send subscription to backend
            const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1/development";
            console.log(`[usePushNotifications] Sending subscription to: ${apiUrl}/users/subscribe`);

            await axios.post(`${apiUrl}/users/subscribe`, sub, {
                withCredentials: true
            });

            console.log('Push subscription successful');
        } catch (error) {
            console.error('Failed to subscribe to push', error);
            // If chrome, sometimes we need to unsubscribe first if the key changed
            if (error instanceof Error && error.message.includes('Registration failed')) {
                console.warn('[usePushNotifications] Registration failed, attempting to unregister SW and retry...');
                // Optional: Force unregister SW to clean state
                const registration = await navigator.serviceWorker.ready;
                await registration.unregister();
                window.location.reload();
            }
        }
    }, []);

    const unsubscribeFromPush = async () => {
        try {
            if (subscription) {
                await subscription.unsubscribe();
                // Notify backend
                const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1/development";
                await axios.post(`${apiUrl}/users/unsubscribe`, {
                    endpoint: subscription.endpoint
                }, {
                    withCredentials: true
                });

                setSubscription(null);
                setIsSubscribed(false);
            }
        } catch (error) {
            console.error('Failed to unsubscribe', error);
        }
    };

    return {
        isSubscribed,
        permission,
        subscribeToPush,
        unsubscribeFromPush
    };
};
