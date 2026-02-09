import { AsyncQueuer } from '@tanstack/pacer';
import { MessageWithQueue, QueueConfig, QueueState } from '@/types';
import { messageDexieService } from './message.dexie.service';
import { socketService } from './socket.service';
import { SocketEvents } from '@/types/socket-events';

/**
 * Message Queue Service
 * 
 * Manages message queuing, retry logic, and state persistence using TanStack Pacer.
 * Handles concurrent message processing with exponential backoff retry strategy.
 */
class MessageQueueService {
    private queuer: AsyncQueuer<MessageWithQueue> | null = null;
    private config: QueueConfig;
    private stateChangeCallbacks: Set<(state: QueueState) => void> = new Set();
    private statusChangeCallbacks: Set<(messageId: string, status: string) => void> = new Set();
    private isOnline: boolean = true;
    private initialized: boolean = false;

    constructor(config?: Partial<QueueConfig>) {
        // Default configuration
        this.config = {
            maxRetries: 5,
            baseWaitMs: 1000,
            maxWaitMs: 30000,
            jitter: 0.3,
            concurrency: 3,
            minConcurrency: 1,
            sendTimeoutMs: 10000,
            persistQueueState: true,
            ...config
        };

        console.log('[MessageQueueService] Initialized with config:', this.config);
    }

    /**
     * Initialize the queue service and restore pending messages from Dexie
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('[MessageQueueService] Already initialized');
            return;
        }

        console.log('[MessageQueueService] Initializing...');

        // Create the AsyncQueuer instance
        this.createQueuer();

        // Listen to socket connection events
        this.setupSocketListeners();

        // Restore pending messages from Dexie
        await this.restorePendingMessages();

        this.initialized = true;
        console.log('[MessageQueueService] Initialization complete');
    }

    /**
     * Setup socket connection listeners to pause/resume queue
     */
    private setupSocketListeners(): void {
        const socket = socketService.getSocket();

        socket.on('connect', () => {
            console.log('[MessageQueueService] Socket connected - resuming queue');
            this.setNetworkStatus(true);
        });

        socket.on('disconnect', () => {
            console.log('[MessageQueueService] Socket disconnected - pausing queue');
            this.setNetworkStatus(false);
        });

        socket.on('connect_error', () => {
            console.log('[MessageQueueService] Socket connection error - pausing queue');
            this.setNetworkStatus(false);
        });

        // Set initial status based on socket connection
        this.setNetworkStatus(socket.connected);
    }

    /**
     * Create the AsyncQueuer instance with configuration
     */
    private createQueuer(): void {
        this.queuer = new AsyncQueuer(
            async (message: MessageWithQueue) => {
                return await this.processMessage(message);
            },
            {
                concurrency: this.config.concurrency,
                started: true,
                onSuccess: async (result, message) => {
                    console.log('[MessageQueueService] Message sent successfully:', message.id);
                    await messageDexieService.updateMessageStatus(message.id, 'sent');
                    await messageDexieService.clearQueueMetadata(message.id);
                    this.emitStatusChange(message.id, 'sent');
                    this.emitStateChange();
                },
                onError: (error, message) => {
                    console.error('[MessageQueueService] Message processing error:', message.id, error);
                    this.emitStateChange();
                },
                onSettled: (message) => {
                    this.emitStateChange();
                }
            }
        );

        console.log('[MessageQueueService] AsyncQueuer created');
    }

    /**
     * Process a single message with retry logic
     */
    private async processMessage(message: MessageWithQueue): Promise<void> {
        console.log('[MessageQueueService] Processing message:', message.id);

        // Update status to sending
        await messageDexieService.updateMessageStatus(message.id, 'sending');
        this.emitStatusChange(message.id, 'sending');

        // Retry logic with exponential backoff
        let lastError: Error | null = null;
        const maxAttempts = this.config.maxRetries;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // Increment retry count in Dexie
                if (attempt > 0) {
                    await messageDexieService.incrementRetryCount(message.id);
                }

                // Attempt to send via socket
                await this.sendViaSocket(message);

                // Success!
                console.log(`[MessageQueueService] Message sent on attempt ${attempt + 1}:`, message.id);
                return;

            } catch (error) {
                lastError = error as Error;
                console.error(`[MessageQueueService] Send attempt ${attempt + 1} failed:`, message.id, error);

                // If not the last attempt, wait with exponential backoff
                if (attempt < maxAttempts - 1) {
                    const backoffMs = this.calculateBackoff(attempt);
                    console.log(`[MessageQueueService] Retrying in ${backoffMs}ms...`);
                    await this.sleep(backoffMs);
                }
            }
        }

        // All retries exhausted - mark as failed
        console.error('[MessageQueueService] All retries exhausted for message:', message.id);
        await messageDexieService.updateMessageStatus(message.id, 'failed');
        await messageDexieService.updateQueueMetadata(message.id, {
            error: lastError?.message || 'Unknown error',
            errorType: this.classifyError(lastError)
        });
        this.emitStatusChange(message.id, 'failed');
        throw lastError;
    }

    /**
     * Send message via Socket.io
     */
    private async sendViaSocket(message: MessageWithQueue): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = socketService.getSocket();

            // Check if socket is connected
            if (!socket.connected) {
                reject(new Error('Socket not connected'));
                return;
            }

            // Set timeout
            const timeoutId = setTimeout(() => {
                reject(new Error('Send timeout'));
            }, this.config.sendTimeoutMs);

            // Emit message
            socket.emit(SocketEvents.MESSAGE_SEND, {
                message,
                conversationId: message.conversationId
            }, (ack: any) => {
                clearTimeout(timeoutId);

                if (ack?.error) {
                    reject(new Error(ack.error));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Calculate exponential backoff with jitter
     */
    private calculateBackoff(attempt: number): number {
        // Exponential backoff: baseWait * 2^attempt
        const exponentialWait = this.config.baseWaitMs * Math.pow(2, attempt);

        // Cap at maxWait
        const cappedWait = Math.min(exponentialWait, this.config.maxWaitMs);

        // Apply jitter (±30%)
        const jitterRange = cappedWait * this.config.jitter;
        const jitter = (Math.random() * 2 - 1) * jitterRange;

        return Math.max(0, cappedWait + jitter);
    }

    /**
     * Classify error type
     */
    private classifyError(error: Error | null): 'network' | 'server' | 'timeout' | 'unknown' {
        if (!error) return 'unknown';

        const message = error.message.toLowerCase();

        if (message.includes('timeout')) return 'timeout';
        if (message.includes('network') || message.includes('offline')) return 'network';
        if (message.includes('server') || message.includes('5')) return 'server';

        return 'unknown';
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Restore pending messages from Dexie on app load
     */
    private async restorePendingMessages(): Promise<void> {
        try {
            const pendingMessages = await messageDexieService.getPendingMessagesForQueue();

            if (pendingMessages.length > 0) {
                console.log(`[MessageQueueService] Restoring ${pendingMessages.length} pending messages`);

                for (const message of pendingMessages) {
                    await this.enqueueMessage(message);
                }
            }
        } catch (error) {
            console.error('[MessageQueueService] Error restoring pending messages:', error);
        }
    }

    /**
     * Enqueue a message for processing
     */
    async enqueueMessage(message: MessageWithQueue): Promise<void> {
        if (!this.queuer) {
            console.error('[MessageQueueService] Queue not initialized');
            return;
        }

        // Check for duplicate
        const existingMessages = this.queuer.peekAllItems();
        if (existingMessages.some(m => m.id === message.id)) {
            console.log('[MessageQueueService] Message already in queue:', message.id);
            return;
        }

        // Add to queue
        this.queuer.addItem(message);
        console.log('[MessageQueueService] Message enqueued:', message.id);

        this.emitStateChange();
    }

    /**
     * Retry a failed message
     */
    async retryMessage(messageId: string): Promise<void> {
        try {
            const message = await messageDexieService.getPendingMessagesForQueue();
            const failedMessage = message.find(m => m.id === messageId);

            if (!failedMessage) {
                console.error('[MessageQueueService] Message not found:', messageId);
                return;
            }

            // Reset status and retry count
            await messageDexieService.updateMessageStatus(messageId, 'pending');
            await messageDexieService.updateQueueMetadata(messageId, {
                retryCount: 0,
                lastAttemptTimestamp: Date.now(),
                error: undefined,
                errorType: undefined
            });

            // Re-enqueue
            await this.enqueueMessage(failedMessage);

            console.log('[MessageQueueService] Message retry initiated:', messageId);
        } catch (error) {
            console.error('[MessageQueueService] Error retrying message:', error);
        }
    }

    /**
     * Get current queue state
     */
    getQueueState(): QueueState {
        if (!this.queuer) {
            return {
                queueSize: 0,
                activeCount: 0,
                errorCount: 0,
                pendingMessages: [],
                isOnline: this.isOnline,
                isPaused: false
            };
        }

        const items = this.queuer.peekAllItems();
        const pendingMessages = items.map(msg => ({
            messageId: msg.id,
            retryCount: msg.queueMetadata?.retryCount || 0,
            lastAttemptTimestamp: msg.queueMetadata?.lastAttemptTimestamp || Date.now(),
            error: msg.queueMetadata?.error,
            status: (msg.status === 'delivered' || msg.status === 'read') ? 'sent' : msg.status as 'pending' | 'sending' | 'sent' | 'failed'
        }));

        return {
            queueSize: this.queuer.store.state.size,
            activeCount: this.queuer.store.state.activeItems?.length || 0,
            errorCount: this.queuer.store.state.errorCount || 0,
            pendingMessages,
            isOnline: this.isOnline,
            isPaused: !this.queuer.store.state.isRunning
        };
    }

    /**
     * Get all pending messages
     */
    async getPendingMessages(): Promise<MessageWithQueue[]> {
        return await messageDexieService.getPendingMessagesForQueue();
    }

    /**
     * Subscribe to queue state changes
     */
    onStateChange(callback: (state: QueueState) => void): () => void {
        this.stateChangeCallbacks.add(callback);

        // Return unsubscribe function
        return () => {
            this.stateChangeCallbacks.delete(callback);
        };
    }

    /**
     * Subscribe to message status changes
     */
    onMessageStatusChange(callback: (messageId: string, status: string) => void): () => void {
        this.statusChangeCallbacks.add(callback);

        // Return unsubscribe function
        return () => {
            this.statusChangeCallbacks.delete(callback);
        };
    }

    /**
     * Emit state change event to all subscribers
     */
    private emitStateChange(): void {
        const state = this.getQueueState();
        this.stateChangeCallbacks.forEach(callback => callback(state));
    }

    /**
     * Emit status change event to all subscribers
     */
    private emitStatusChange(messageId: string, status: string): void {
        this.statusChangeCallbacks.forEach(callback => callback(messageId, status));
    }

    /**
     * Set network status and adjust queue behavior
     */
    setNetworkStatus(isOnline: boolean): void {
        const wasOnline = this.isOnline;
        this.isOnline = isOnline;

        if (!this.queuer) return;

        if (isOnline && !wasOnline) {
            // Just came online - resume queue
            console.log('[MessageQueueService] Network online - resuming queue');
            this.queuer.start();
        } else if (!isOnline && wasOnline) {
            // Just went offline - pause queue
            console.log('[MessageQueueService] Network offline - pausing queue');
            this.queuer.stop();
        }

        this.emitStateChange();
    }

    /**
     * Pause queue processing
     */
    pause(): void {
        if (this.queuer) {
            this.queuer.stop();
            console.log('[MessageQueueService] Queue paused');
            this.emitStateChange();
        }
    }

    /**
     * Resume queue processing
     */
    resume(): void {
        if (this.queuer) {
            this.queuer.start();
            console.log('[MessageQueueService] Queue resumed');
            this.emitStateChange();
        }
    }

    /**
     * Clear all messages from queue
     */
    async clear(): Promise<void> {
        if (this.queuer) {
            this.queuer.clear();
            console.log('[MessageQueueService] Queue cleared');
            this.emitStateChange();
        }
    }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();
export default messageQueueService;
