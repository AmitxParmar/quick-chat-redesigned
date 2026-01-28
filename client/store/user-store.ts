import { User } from "@/types";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UserState = {
    activeChatUser: User | null;
    setActiveChatUser: (user: User | null) => void;
};

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            activeChatUser: null,
            setActiveChatUser: (user) => set({ activeChatUser: user }),
        }),
        {
            name: "user-storage",
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
