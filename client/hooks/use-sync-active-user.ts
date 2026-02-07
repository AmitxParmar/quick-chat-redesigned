import { useUserStore } from "@/store/user-store";
import { useEffect } from "react";

/**
 * Synchronizes the active chat user in the global store with the provided user ID.
 * If the current active user in the store doesn't match the provided ID, it updates 
 * the store with a fallback user object.
 * 
 * @param activeChatUserId - The WhatsApp ID of the user to set as active.
 */
export const useSyncActiveUser = (activeChatUserId: string) => {
    const activeChatUser = useUserStore((state) => state.activeChatUser);
    const setActiveChatUser = useUserStore((state) => state.setActiveChatUser);

    useEffect(() => {
        // If availability of activeChatUser does not match the route param, update it
        if (activeChatUserId && activeChatUser?.waId !== activeChatUserId) {
            // Fallback object if we don't have full user data yet
            setActiveChatUser({
                waId: activeChatUserId,
                name: activeChatUserId, // Fallback name until full data is loaded
                isOnline: false,
                profilePicture: undefined,
                status: "Available",
                lastSeen: new Date(),
            });
        }
    }, [activeChatUserId, activeChatUser?.waId, setActiveChatUser]);
};
