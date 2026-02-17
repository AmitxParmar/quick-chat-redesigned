"use client";
import React from "react";
import { ConversationListItem } from "./conversation-list-item";
import { useConversations } from "@/hooks/useConversations";
import { useUIStore } from "@/store/ui-store";
import ContactList from "@/components/contacts-list";

const ConversationList = () => {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversations();
  const isContactListOpen = useUIStore((state) => state.isContactListOpen);
  const observerTarget = React.useRef<HTMLDivElement>(null);

  // Flatten conversations from all pages
  const conversations = React.useMemo(() => {
    return data?.pages.flatMap((page) => page.conversations) || [];
  }, [data]);

  // Infinite scroll observer
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  console.log("Error Contact List", error);

  // If contact list is open, render it instead of conversations
  if (isContactListOpen) {
    return <ContactList />;
  }

  return (
    <div className="flex-auto overflow-auto px-1.5 max-h-full custom-scrollbar">
      {isLoading ? (
        <ConversationListSkeleton />
      ) : conversations.length > 0 ? (
        <>
          {conversations.map((contact) => (
            <ConversationListItem key={contact.id} data={contact} />
          ))}
          {/* Sentinel for infinite scroll */}
          <div ref={observerTarget} className="h-4 w-full flex justify-center py-2">
            {isFetchingNextPage && (
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            )}
          </div>
        </>
      ) : (
        <NoConversations />
      )}
    </div>
  );
};

export default ConversationList;

// Simple skeleton loader for chat list items
const ConversationListSkeleton = () => {
  // WhatsApp Web colors
  const bgPrimary = "bg-background"; // chat list background
  const bgSecondary = "bg-background"; // chat item background
  const bg = "bg-wa-info";

  return (
    <div className={`flex flex-col gap-1 px-2 py-2 ${bgPrimary}`}>
      {Array.from({ length: 16 }).map((_, idx) => (
        <div
          key={idx}
          className={`flex min-h-16 items-center border-b gap-3 px-3 py-4 animate-pulse ${bgSecondary}`}
        >
          <div className={`w-12 h-12 rounded-full ${bg}`} />
          <div className="flex-1">
            <div className={`h-4 w-1/2 ${bg} rounded mb-2`} />
            <div className={`h-3 w-1/3 ${bg} rounded`} />
          </div>
        </div>
      ))}
    </div>
  );
};

const NoConversations = () => (
  <div className="flex flex-col items-center justify-center h-full py-10 text-gray-400">
    <svg
      className="w-12 h-12 mb-2 text-gray-300"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8h10M7 12h4m-4 4h6m5 4v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2m16-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12"
      />
    </svg>
    <span className="text-lg font-medium">No conversations</span>
    <span className="text-sm">Start a new chat to see it here.</span>
  </div>
);
