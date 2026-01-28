import { useEffect } from "react";
import { useUserStore } from "@/store/user-store";

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
