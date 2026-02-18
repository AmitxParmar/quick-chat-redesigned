import { useUserStore } from "@/store/user-store";
import { useUIStore } from "@/store/ui-store";
import { Contact } from "@/types";
import { ArrowLeft, SearchIcon, Plus } from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useContacts } from "@/hooks/useContacts";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useGetConversationId } from "@/hooks/useConversations";



type ContactsGrouped = Record<string, Contact[]>;

function ChatListItem({
  data,
  onClick,
}: {
  data: Contact;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex items-center px-6 py-3 hover:bg-accent cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg font-bold text-gray-700 mr-4">
        {data.name[0]}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-primary truncate">{data.name}</span>
        <span className="text-xs text-muted-foreground truncate">
          {data.isOnline ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}

const AddContactDialog = dynamic(
  () => import("./add-contact-dialog"),
  { ssr: false }
);

const ContactList = () => {
  // allContacts might be undefined or an empty object
  const { data: allContacts } = useContacts();
  const { mutateAsync: getConversationId } = useGetConversationId();
  const [searchTerm, setSearchTerm] = useState("");
  const setContactListOpen = useUIStore((state) => state.setContactListOpen);
  const setActiveChatUser = useUserStore((state) => state.setActiveChatUser);
  const router = useRouter();

  // Add Contact Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Memoize filtered contacts to prevent infinite re-renders
  const searchContacts = useMemo(() => {
    // If contacts are missing or empty, return empty object
    if (!allContacts || Object.keys(allContacts).length === 0) {
      return {};
    }

    // Filter contacts by search term
    const filteredData: ContactsGrouped = {};
    Object.keys(allContacts).forEach((key) => {
      // Defensive: allContacts[key] might be undefined or not an array
      const group = allContacts[key];
      // Only filter if group is an array
      if (Array.isArray(group)) {
        filteredData[key] = group.filter((obj: Contact) =>
          obj.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        filteredData[key] = [];
      }
    });
    return searchTerm.length ? filteredData : allContacts;
  }, [searchTerm, allContacts]);

  // handleConversation like in conversation-list-item.tsx
  const handleConversation = useCallback(
    (contact: Contact) => async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (contact) {
        setActiveChatUser(contact);
      }

      // Call getConversationId with the correct waId as a string
      getConversationId(contact.waId, {
        onSuccess: (data) => {
          setContactListOpen(false);
          const convoId = data.id; // Always use Mongo _id for routing
          router.push(`/conversation/${convoId}/${contact.waId}`);
        },
        onError: (error) => console.error(error),
      });

      // Push to conversation page with waId (no conversationId yet, so just use waId)
    },
    [router, setActiveChatUser, setContactListOpen, getConversationId]
  );

  // If contacts are missing or empty, show a message
  const isEmpty =
    !allContacts ||
    Object.keys(allContacts).length === 0 ||
    Object.values(allContacts).every(
      (arr) => !Array.isArray(arr) || arr.length === 0
    );

  return (
    <div className="flex-auto w-full overflow-auto px-1.5 max-h-full custom-scrollbar">
      <div className="h-full  transition-all min-w-full flex flex-col bg-background">
        <div className="h-24 flex items-end px-3 py-4">
          <div className="flex items-center gap-4 text-lg font-semibold">
            <ArrowLeft
              onClick={() => setContactListOpen(false)}
              className="cursor-pointer text-xl"
            />
            <span>New chat</span>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <button
                  className="ml-2 p-1 rounded-full hover:bg-accent transition-colors"
                  title="Add Contact"
                  type="button"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </DialogTrigger>
              <AddContactDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
              />
            </Dialog>
          </div>
        </div>
        <div className="flex-auto h-full overflow-auto custom-scrollbar bg-search-input-container-background">
          <div className="flex py-3 items-center gap-3 h-14">
            <div className="bg-panel-header-background flex flex-grow items-center gap-5 px-3 py-1 mx-4 rounded-lg">
              <div>
                <SearchIcon className="text-panel-header-icon cursor-pointer text-lg" />
              </div>
              <div className="w-full">
                <input
                  type="text"
                  placeholder="Search Contacts"
                  className="bg-transparent w-full text-sm focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          {isEmpty ? (
            <div className="text-center text-muted-foreground py-8">
              No contacts found.
            </div>
          ) : (
            Object.entries(searchContacts).map(([initialLetter, userList]) => {
              // Only show section if there are users in it
              if (!Array.isArray(userList) || userList.length === 0)
                return null;
              return (
                <div key={initialLetter}>
                  {searchTerm.length === 0 && (
                    <div className="text-teal-light pl-10 py-2 font-semibold text-xs uppercase tracking-wider">
                      {initialLetter}
                    </div>
                  )}
                  <div>
                    {userList.map((contact: Contact) => (
                      <ChatListItem
                        data={contact}
                        key={contact.id}
                        onClick={handleConversation(contact)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactList;
