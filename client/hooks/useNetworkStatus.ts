import { useState, useEffect } from 'react';

/**
 * Network status information
 */
interface NetworkStatus {
    /** Whether the browser is currently online */
    isOnline: boolean;
    /** Whether the browser just came back online (resets after 1 second) */
    wasOffline: boolean;
}

/**
 * Hook to detect browser network status using native online/offline events.
 * 
 * This hook provides real-time network status detection and tracks when
 * the browser transitions from offline to online state.
 * 
 * @returns NetworkStatus object with isOnline and wasOffline flags
 * 
 * @example
 * ```tsx
 * function MessageBar() {
 *   const { isOnline, wasOffline } = useNetworkStatus();
 *   
 *   return (
 *     <div>
 *       {!isOnline && <div>You are offline</div>}
 *       {wasOffline && <div>Back online! Sending pending messages...</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
    // Initialize with current browser online status (SSR-safe)
    const [isOnline, setIsOnline] = useState(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    // Track if we just came back online
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        // Handler for when browser comes online
        const handleOnline = () => {
            console.log('[useNetworkStatus] Network online');
            setIsOnline(true);
            setWasOffline(true);

            // Reset wasOffline flag after 1 second
            setTimeout(() => setWasOffline(false), 1000);
        };

        // Handler for when browser goes offline
        const handleOffline = () => {
            console.log('[useNetworkStatus] Network offline');
            setIsOnline(false);
            setWasOffline(false);
        };

        // Register event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, wasOffline };
}
