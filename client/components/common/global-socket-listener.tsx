"use client";

import { useEffect } from "react";
import { socketService } from "@/services/socket.service";
import { SocketEvents } from "@/types/socket-events";
import { messageDexieService } from "@/services/message.dexie.service";
import useAuth from "@/hooks/useAuth";

export default function GlobalSocketListener() {
    const { user } = useAuth();

    // Initialize socket connection when user is authenticated
    useEffect(() => {
        if (!user?.waId) return;

        const socket = socketService.getSocket();

        // Listener for incoming messages
        const onMessageCreated = (payload: { message: any; conversationId: string }) => {
            console.log("[GlobalSocketListener] Received message:", payload?.message?.id);
            if (payload?.message) {
                messageDexieService.addMessage(payload.message).catch((err) => {
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

        return () => {
            socket.off(SocketEvents.MESSAGE_CREATED, onMessageCreated);
            socket.off(SocketEvents.MESSAGE_STATUS_UPDATED, onStatusUpdated);
        };
    }, [user?.waId]);

    return null;
}
