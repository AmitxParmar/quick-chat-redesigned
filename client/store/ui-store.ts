import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Represents the UI state and actions for the application.
 */
type UIState = {
    /** Whether the contact list sidebar is currently open. */
    isContactListOpen: boolean;
    /** Toggles the open/closed state of the contact list. */
    toggleContactList: () => void;
    /** Sets the open/closed state of the contact list to a specific value. */
    setContactListOpen: (open: boolean) => void;
};

/**
 * A hook-based store for managing UI-related state with persistence in session storage.
 */
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
