import { Socket } from "socket.io-client";
import { Message } from "@/types";
import { messageDexieService } from "@/services/message.dexie.service";
import { SocketEvents } from "@/types/socket-events";

/**
 * Handles incoming `MESSAGE_CREATED` events.
 * Saves message to Dexie and emits delivered status if acceptable.
 */
export const handleIncomingMessage = (
    socket: Socket,
    userWaId: string | undefined,
    payload: { message: Message; conversationId: string }
) => {
    if (payload?.message) {
        messageDexieService
            .addMessage(payload.message)
            .then(() => {
                // Ack delivery
                // Only ack if it wasn't sent by me
                if (payload.message.from !== userWaId) {
                    socket.emit(SocketEvents.MESSAGE_STATUS_UPDATED, {
                        id: payload.message.id,
                        status: "delivered",
                        conversationId: payload.conversationId,
                        updatedBy: userWaId,
                    });
                }
            })
            .catch((err) => {
                console.error(
                    "[GlobalSocketListener] Failed to save message to Dexie:",
                    err
                );
            });
    }
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
