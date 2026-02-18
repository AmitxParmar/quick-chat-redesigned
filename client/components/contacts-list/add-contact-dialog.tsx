import React, { useState } from "react";
import { useAddContact } from "@/hooks/useContacts";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function AddContactDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [waId, setWaId] = useState("");
    const [nickname, setNickname] = useState("");
    const [error, setError] = useState<string | null>(null);
    const addContactMutation = useAddContact();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!waId.trim()) {
            setError("WhatsApp ID is required.");
            return;
        }
        try {
            // Only waId is sent to the backend, nickname is not supported by the mutation
            await addContactMutation.mutateAsync(waId);

            setWaId("");
            setNickname("");
            onOpenChange(false);
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : (err as { response?: { data?: { message?: string } } })?.response
                        ?.data?.message || "Failed to add contact.";
            setError(errorMessage);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                    <DialogDescription>
                        Enter the WhatsApp ID and an optional nickname to add a new contact.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="waId">
                            WhatsApp ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="waId"
                            type="text"
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none"
                            value={waId}
                            onChange={(e) => setWaId(e.target.value)}
                            required
                            autoFocus
                            placeholder="Enter WhatsApp ID"
                        />
                    </div>
                    <div>
                        <label
                            className="block text-sm font-medium mb-1"
                            htmlFor="nickname"
                        >
                            Nickname <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <input
                            id="nickname"
                            type="text"
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Enter nickname"
                        />
                    </div>
                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            type="button"
                            className="px-4 py-2 rounded bg-muted text-primary"
                            onClick={() => onOpenChange(false)}
                            disabled={addContactMutation.isPending}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded bg-primary text-white"
                            disabled={addContactMutation.isPending}
                        >
                            {addContactMutation.isPending ? "Adding..." : "Add"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
