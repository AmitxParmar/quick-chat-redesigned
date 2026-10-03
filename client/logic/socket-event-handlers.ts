import { Socket } from "socket.io-client";
import { Message } from "@/types";
import { messageDexieService } from "@/services/message.dexie.service";
import { SocketEvents } from "@/types/socket-events";

/**
 * Bounded buffer for incoming `MESSAGE_CREATED` events
 * (PERFORMANCE_ENGINEERING 1.4/1.5). Bursts (busy groups, catch-up
 * batches) used to cause one Dexie write + one store notification per
 * message. Now events accumulate here and flush once per macrotask via
 * bulkPut — a single Dexie transaction, a single liveQuery update.
 *
 * setTimeout(0), not rAF: rAF stalls in background tabs, which would
 * stall persistence. Overflow drops the OLDEST (stale first) and counts
 * them; catch-up (conversation:sync) re-fetches anything truly missed.
 */
const MAX_INCOMING_BUFFER = 500;
let incomingBuffer: { message: Message; conversationId: string }[] = [];
let flushScheduled = false;
let droppedIncoming = 0;

/** Dropped-event counter for the perf overlay; consume-and-reset. */
export const consumeIncomingDroppedCount = (): number => {
    const n = droppedIncoming;
    droppedIncoming = 0;
    return n;
};

/**
 * Handles incoming `MESSAGE_CREATED` events.
 * Buffers the event; the scheduled flush persists + acks the batch.
 */
export const handleIncomingMessage = (
    socket: Socket,
    userWaId: string | undefined,
    payload: { message: Message; conversationId: string }
) => {
    if (!payload?.message) return;
    incomingBuffer.push({ message: payload.message, conversationId: payload.conversationId });
    const overflow = incomingBuffer.length - MAX_INCOMING_BUFFER;
    if (overflow > 0) {
        incomingBuffer.splice(0, overflow);
        droppedIncoming += overflow;
    }
    if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(() => flushIncoming(socket, userWaId), 0);
    }
};

function flushIncoming(socket: Socket, userWaId: string | undefined): void {
    flushScheduled = false;
    if (incomingBuffer.length === 0) return;
    const batch = incomingBuffer;
    incomingBuffer = [];
    messageDexieService
        .addMessages(batch.map((b) => b.message))
        .then(() => {
            // Ack delivery per message — skip our own echoes.
            for (const { message, conversationId } of batch) {
                if (message.from !== userWaId) {
                    socket.emit(SocketEvents.MESSAGE_STATUS_UPDATED, {
                        id: message.id,
                        status: "delivered",
                        conversationId,
                        updatedBy: userWaId,
                    });
                }
            }
        })
        .catch((err) => {
            console.error(
                "[GlobalSocketListener] Failed to save message batch to Dexie:",
                err
            );
        });
}

/**
 * Handles `conversation:catchup` payloads (PERFORMANCE_ENGINEERING 1.3).
 * bulkPut is idempotent — replays and overlaps are safe.
 */
export const handleCatchup = (payload: { conversationId: string; messages: Message[] }) => {
    if (!payload?.messages?.length) return;
    messageDexieService.addMessages(payload.messages).catch(console.error);
};

/**
 * Handles `MESSAGE_STATUS_UPDATED` events.
 * Updates message status in Dexie.
 */
export const handleStatusUpdate = (payload: { id: string; status: string }) => {
    if (payload?.id && payload?.status) {
        messageDexieService
            .updateMessageStatus(payload.id, payload.status)
            .catch(console.error);
    }
};

/**
 * Handles `MESSAGES_MARKED_AS_READ` events.
 * Marks messages as read in Dexie.
 */
export const handleBulkRead = (payload: {
    conversationId: string;
    readBy: string;
}) => {
    if (payload?.conversationId && payload?.readBy) {
        messageDexieService
            .markMessagesAsRead(payload.conversationId, payload.readBy)
            .catch(console.error);
    }
};

/**
 * Handles `USER_ONLINE` events.
 * Resends any pending messages for that user.
 */
export const handleUserOnline = (
    socket: Socket,
    { waId }: { waId: string }
) => {
    if (!waId) return;

    messageDexieService
        .getPendingMessages(waId)
        .then((pendingMessages) => {
            if (pendingMessages.length > 0) {
                pendingMessages.forEach((msg) => {
                    // Re-emit message:send
                    socket.emit(SocketEvents.MESSAGE_SEND, {
                        message: msg,
                        conversationId: msg.conversationId,
                    });
                });
            }
        })
        .catch(console.error);
};

/**
 * Handles `AUTH_FORCED_LOGOUT` events.
 * Alerts the user, calls logout API, and redirects.
 */
export const handleForcedLogout = async (
    payload: { reason: string; message: string },
    logoutApi: () => Promise<any>
) => {
    console.warn("[GlobalSocketListener] Forced logout:", payload.message);
    // Clear local data and cookies, then redirect to login
    if (typeof window !== "undefined") {
        // Show alert
        alert(
            payload.message ||
            "You have been logged out because your account was accessed from another device."
        );

        // Call logout API to clear cookies
        try {
            await logoutApi();
        } catch (e) {
            console.error("[GlobalSocketListener] Failed to call logout API:", e);
        }

        // Redirect to login
        window.location.replace("/login");
    }
};
