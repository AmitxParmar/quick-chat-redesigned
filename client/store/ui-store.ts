import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UIState = {
    isContactListOpen: boolean;
    toggleContactList: () => void;
    setContactListOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isContactListOpen: false,
            toggleContactList: () =>
                set((state) => ({ isContactListOpen: !state.isContactListOpen })),
            setContactListOpen: (open: boolean) => set({ isContactListOpen: open }),
        }),
        {
            name: "ui-storage",
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
