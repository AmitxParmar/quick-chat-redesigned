import { useEffect } from "react";
import { socketService } from "@/services/socket.service";
import { logout as logoutApi } from "@/services/auth.service";
import { SocketEvents } from "@/types/socket-events";
import useAuth from "@/hooks/useAuth";
import { Message } from "@/types";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
    handleIncomingMessage,
    handleStatusUpdate,
    handleBulkRead,
    handleUserOnline,
    handleForcedLogout,
} from "@/logic/socket-event-handlers";

export default function GlobalSocketListener() {
    const { user } = useAuth();
    const { subscribeToPush } = usePushNotifications();

    // Initialize socket connection when user is authenticated
    useEffect(() => {
        if (!user?.waId) return;

        // Auto-subscribe to push notifications
        subscribeToPush();

        const socket = socketService.getSocket();

        // Listener for incoming messages
        const onMessageCreated = (payload: { message: Message; conversationId: string }) =>
            handleIncomingMessage(socket, user?.waId, payload);

        socket.on(SocketEvents.MESSAGE_CREATED, onMessageCreated);

        // Listener for status updates
        socket.on(SocketEvents.MESSAGE_STATUS_UPDATED, handleStatusUpdate);

        // Listener for bulk read receipt
        socket.on(SocketEvents.MESSAGES_MARKED_AS_READ, handleBulkRead);

        // Listener for User Online -> Resend pending messages
        const onUserOnline = ({ waId }: { waId: string }) =>
            handleUserOnline(socket, { waId });

        socket.on(SocketEvents.USER_ONLINE, onUserOnline);

        // Single-device login: Handle forced logout when user logs in from another device
        const onForcedLogout = (payload: { reason: string; message: string }) =>
            handleForcedLogout(payload, logoutApi);

        socket.on(SocketEvents.AUTH_FORCED_LOGOUT, onForcedLogout);

        return () => {
            socket.off(SocketEvents.MESSAGE_CREATED, onMessageCreated);
            socket.off(SocketEvents.MESSAGE_STATUS_UPDATED, handleStatusUpdate);
            socket.off(SocketEvents.MESSAGES_MARKED_AS_READ, handleBulkRead);
            socket.off(SocketEvents.USER_ONLINE, onUserOnline);
            socket.off(SocketEvents.AUTH_FORCED_LOGOUT, onForcedLogout);
        };
    }, [user?.waId, subscribeToPush]);

    return null;
}
