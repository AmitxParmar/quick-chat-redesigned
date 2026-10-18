"use client";

import { useEffect, useMemo } from "react";
import { socketService } from "@/services/socket.service";
import { SocketEvents } from "@/types/socket-events";
import { useContacts } from "@/hooks/useContacts";
import { useConversations } from "@/hooks/useConversations";
import { useUserStore } from "@/store/user-store";
import useAuth from "@/hooks/useAuth";

/**
 * Roster-room presence subscription (PERFORMANCE_ENGINEERING 3.1).
 *
 * The server used to broadcast every `user:online`/`user:offline` to ALL
 * connected sockets — each client then ran a Dexie scan per event. Now the
 * client publishes the waIds it actually cares about (contacts +
 * conversation peers + open chat, capped) and the server emits presence
 * only into `watch:{waId}` rooms. Cost scales with your roster, not with
 * total connected users.
 *
 * Mount once (in GlobalSocketListener). Full-set replace semantics:
 * re-published whenever the roster changes and on every reconnect
 * (server room membership is per-connection state).
 */
const MAX_WATCH = 300;

export function usePresenceWatch() {
    const { user } = useAuth();
    const selfWaId = user?.waId;
    const activeChatWaId = useUserStore((state) => state.activeChatUser?.waId);
    const { data: contacts } = useContacts();
    const { data: conversations } = useConversations();

    const watchWaIds = useMemo(() => {
        const set = new Set<string>();

        if (contacts) {
            for (const group of Object.values(contacts)) {
                if (!Array.isArray(group)) continue;
                for (const contact of group) {
                    if (contact?.waId && contact.waId !== selfWaId) {
                        set.add(contact.waId);
                    }
                }
            }
        }

        const pages = conversations?.pages;
        if (pages) {
            for (const page of pages) {
                for (const convo of page?.conversations ?? []) {
                    for (const participant of convo?.participants ?? []) {
                        if (participant?.waId && participant.waId !== selfWaId) {
                            set.add(participant.waId);
                        }
                    }
                }
            }
        }

        if (activeChatWaId && activeChatWaId !== selfWaId) {
            set.add(activeChatWaId);
        }

        return [...set].slice(0, MAX_WATCH);
    }, [contacts, conversations, activeChatWaId, selfWaId]);

    useEffect(() => {
        if (!selfWaId) return;
        const socket = socketService.getSocket();

        // Always publish (even empty) so a shrunken roster clears
        // stale server-side rooms via replace semantics.
        const publish = () => {
            socket.emit(SocketEvents.PRESENCE_WATCH, { waIds: watchWaIds });
        };

        publish();
        socket.on("connect", publish);
        return () => {
            socket.off("connect", publish);
        };
    }, [selfWaId, watchWaIds]);
}