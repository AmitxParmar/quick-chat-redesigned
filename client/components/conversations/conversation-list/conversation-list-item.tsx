"use client";
import React, { useCallback, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MessageStatus from "@/components/common/message-status";
import { useUserStore } from "@/store/useUserStore";
import { Conversation } from "@/types";
import { useRouter } from "next/navigation";
import { calculateTime } from "@/utils/calculateTime";
import { useDeleteConversation } from "@/hooks/useConversations";
import { Trash2, Archive } from "lucide-react";
import useAuth from "@/hooks/useAuth";

interface ConversationListItemProps {
  data: Conversation;
}

export const ConversationListItem = React.memo<ConversationListItemProps>(
  ({ data }) => {
    const router = useRouter();
    const { setActiveChatUser } = useUserStore();
    const deleteConversation = useDeleteConversation();
    const { user } = useAuth();

    // Get the other participant (not the current user)
    const otherParticipant = useMemo(() => {
      const currentWaId = user?.waId;
      if (!currentWaId) return data.participants[0];
      return (
        data.participants.find((p) => p.waId !== currentWaId) ||
        data.participants[0]
      );
    }, [data.participants, user?.waId]);

    // Check if the last message is from the current user
    const isOwnMessage = useMemo(() => {
      const currentWaId = user?.waId;
      if (!currentWaId) return false;
      return data.lastMessage?.from === currentWaId;
    }, [data.lastMessage?.from, user?.waId]);

    // Format the timestamp
    const createdAtTime = useMemo(() => {
      if (!data.lastMessage?.timestamp) return "";
      return calculateTime(new Date(data.lastMessage.timestamp));
    }, [data.lastMessage?.timestamp]);

    // Get the last message
    const lastMessage = useMemo(() => {
      return data.lastMessage || { text: "", status: "", from: "" };
    }, [data.lastMessage]);

    // Get unread count
    const unreadCount = useMemo(() => {
      return data.unreadCount || 0;
    }, [data.unreadCount]);

    // Check if this is the contacts page
    const isContactsPage = useMemo(() => {
      return data.participants.length === 1;
    }, [data.participants.length]);

    // Handle conversation click
    const handleConversation = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();

        if (otherParticipant) {
          setActiveChatUser({ ...otherParticipant, isOnline: true });
        }

        router.push(`/conversation/${data.id}/${otherParticipant?.waId}`);
      },
      [router, data.id, otherParticipant, setActiveChatUser]
    );

    // Handle delete conversation
    const handleDeleteConversation = useCallback(
      (e: React.MouseEvent, deleteType: "soft" | "hard" = "soft") => {
        e.stopPropagation();
        e.preventDefault();

        if (
          confirm(
            `Are you sure you want to ${deleteType === "soft" ? "archive" : "permanently delete"
            } this conversation?`
          )
        ) {
          deleteConversation.mutate({
            conversationId: data.id,
            deleteType,
          });
        }
      },
      [deleteConversation, data.id]
    );

    // Render message preview
    const renderMessagePreview = useMemo(() => {
      if (isContactsPage) {
        // No 'about' property, so just show a non-breaking space
        return "\u00A0";
      }
      return (
        <div
          className="
            flex items-center h-8 gap-1 max-w-[200px]
            sm:max-w-[250px] md:max-w-[300px] lg:max-w-[200px] xl:max-w-[300px]
          "
        >
          {isOwnMessage && <MessageStatus messageStatus={lastMessage.status} />}
          {lastMessage?.text && (
            <span className="truncate">{lastMessage.text}</span>
          )}
        </div>
      );
    }, [isContactsPage, lastMessage, isOwnMessage]);

    // Render unread badge
    const renderUnreadBadge = useMemo(() => {
      if (unreadCount > 0 && !isOwnMessage) {
        return (
          <span className="bg-label px-[5px] rounded-full text-background font-semibold text-sm">
            {unreadCount}
          </span>
        );
      }
      return null;
    }, [unreadCount, isOwnMessage]);

    return (
      <div className="cursor-pointer my-2 group relative">
        <div
          onClick={handleConversation}
          className="flex rounded-md md:mx-3 touch-auto hover:bg-searchbar/50 transition-all"
        >
          <div className="min-w-fit px-2 md:px-4 pb-1 flex items-center">
            <Avatar className="size-11">
              <AvatarFallback>
                {otherParticipant?.name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </div>
          {/* border should be under this element */}
          <div className="min-h-full border-b -mb-1.5 pb-1 flex flex-col justify-center mt-3 pr-2 w-full">
            <div className="flex justify-between">
              <span className="text-primary">
                {otherParticipant?.name || lastMessage?.from}
              </span>
              {!isContactsPage && (
                <span
                  className={`${unreadCount > 0 && !isOwnMessage
                    ? "text-label"
                    : "text-muted-foreground"
                    } text-sm`}
                >
                  {createdAtTime}
                </span>
              )}
            </div>
            <div className="flex pb-2 pt-1">
              <div className="flex justify-between w-full">
                <span className="text-muted-foreground line-clamp-1 text-sm">
                  {renderMessagePreview}
                </span>
                <span>{renderUnreadBadge}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Delete buttons - only show on hover */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={(e) => handleDeleteConversation(e, "soft")}
            className="p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-orange-600 transition-colors"
            title="Archive conversation"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteConversation(e, "hard")}
            className="p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
            title="Delete conversation permanently"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
);

ConversationListItem.displayName = "ConversationListItem";
