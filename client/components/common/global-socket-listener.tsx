"use client";

import { useEffect } from "react";
import { socketService } from "@/services/socket.service";
import { SocketEvents } from "@/types/socket-events";
import { messageDexieService } from "@/services/message.dexie.service";
import useAuth from "@/hooks/useAuth";
import { Message } from "@/types";

export default function GlobalSocketListener() {
    const { user } = useAuth();

    // Initialize socket connection when user is authenticated
    useEffect(() => {
        if (!user?.waId) return;

        const socket = socketService.getSocket();

        // Listener for incoming messages
        const onMessageCreated = (payload: { message: Message; conversationId: string }) => {
            console.log("[GlobalSocketListener] Received message:", payload?.message?.id);
            if (payload?.message) {
                messageDexieService.addMessage(payload.message).then(() => {
                    // Ack delivery
                    // Only ack if it wasn't sent by me (though relay shouldn't send back to me realistically, but safety check)
                    if (payload.message.from !== user?.waId) {
                        socket.emit(SocketEvents.MESSAGE_STATUS_UPDATED, {
                            id: payload.message.id,
                            status: 'delivered',
                            conversationId: payload.conversationId,
                            updatedBy: user?.waId
                        });
                    }
                }).catch((err) => {
                    console.error("[GlobalSocketListener] Failed to save message to Dexie:", err);
                });
            }
        };

        socket.on(SocketEvents.MESSAGE_CREATED, onMessageCreated);

        // Listener for status updates
        const onStatusUpdated = (payload: { id: string; status: string }) => {
            console.log("[GlobalSocketListener] Status updated:", payload);
            if (payload?.id && payload?.status) {
                messageDexieService.updateMessageStatus(payload.id, payload.status).catch(console.error);
            }
        };

        socket.on(SocketEvents.MESSAGE_STATUS_UPDATED, onStatusUpdated);

        // Listener for bulk read receipt
        const onMessagesRead = (payload: { conversationId: string; readBy: string }) => {
            console.log("[GlobalSocketListener] Messages read by:", payload.readBy);
            if (payload?.conversationId && payload?.readBy) {
                messageDexieService.markMessagesAsRead(payload.conversationId, payload.readBy).catch(console.error);
            }
        };

        socket.on(SocketEvents.MESSAGES_MARKED_AS_READ, onMessagesRead);

        // Listener for User Online -> Resend pending messages
        const onUserOnline = ({ waId }: { waId: string }) => {
            console.log("[GlobalSocketListener] User online:", waId);
            if (!waId) return;

            messageDexieService.getPendingMessages(waId).then((pendingMessages) => {
                if (pendingMessages.length > 0) {
                    console.log(`[GlobalSocketListener] Resending ${pendingMessages.length} pending messages to ${waId}`);
                    pendingMessages.forEach(msg => {
                        // Re-emit message:send
                        socket.emit(SocketEvents.MESSAGE_SEND, {
                            message: msg,
                            conversationId: msg.conversationId
                        });
                    });
                }
            }).catch(console.error);
        };

        socket.on(SocketEvents.USER_ONLINE, onUserOnline);

        // Single-device login: Handle forced logout when user logs in from another device
        const onForcedLogout = (payload: { reason: string; message: string }) => {
            console.warn("[GlobalSocketListener] Forced logout:", payload.message);
            // Clear local data and redirect to login
            if (typeof window !== "undefined") {
                // Show alert before redirect
                alert(payload.message || "You have been logged out because your account was accessed from another device.");
                window.location.href = "/login";
            }
        };

        socket.on(SocketEvents.AUTH_FORCED_LOGOUT, onForcedLogout);

        return () => {
            socket.off(SocketEvents.MESSAGE_CREATED, onMessageCreated);
            socket.off(SocketEvents.MESSAGE_STATUS_UPDATED, onStatusUpdated);
            socket.off(SocketEvents.MESSAGES_MARKED_AS_READ, onMessagesRead);
            socket.off(SocketEvents.USER_ONLINE, onUserOnline);
            socket.off(SocketEvents.AUTH_FORCED_LOGOUT, onForcedLogout);
        };
    }, [user?.waId]);

    return null;
}
