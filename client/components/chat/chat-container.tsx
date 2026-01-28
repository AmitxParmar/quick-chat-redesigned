import MessageLoader from "../common/message-loader";
import MessageBubble from "./message-bubble";
import { useMessages } from "@/hooks/useMessages";
import { useAutoMarkAsRead } from "@/hooks/useConversations";
import { memo, useMemo, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import useAuth from "./../../hooks/useAuth";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useChatParams } from "@/hooks/use-chat-params";

/**
 * ChatContainer with virtualization and WhatsApp-like scroll behavior:
 * - Messages are virtualized for performance (only visible ones render)
 * - Auto-scrolls to bottom when new messages arrive
 * - Maintains scroll position when loading older messages at the top
 */
function ChatContainer() {
  const { conversationId } = useChatParams();
  const { data, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);
  const { user: activeUser } = useAuth();
  const { markConversationAsRead } = useAutoMarkAsRead();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Flatten messages for the virtualizer
  const allMessages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.messages);
  }, [data?.pages]);

  // Setup Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: allMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => 80, []), // Estimates based on typical bubble heights
    overscan: 10,
    useFlushSync: false, // Performance optimization: disable synchronous updates to improve INP
  });

  // Track previous scroll dimensions for restoration after loading older messages
  const prevScrollHeightRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);

  // Auto-scroll to bottom on initial load or NEW messages (at the end of the array)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || allMessages.length === 0) return;

    if (isLoadingMoreRef.current) {
      // Message prepended (Load More)
      const newScrollHeight = rowVirtualizer.getTotalSize();
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      el.scrollTop = scrollDiff;
      isLoadingMoreRef.current = false;
    } else {
      // Newest message (at end) - auto scroll to bottom
      rowVirtualizer.scrollToIndex(allMessages.length - 1, { align: "end" });
    }
  }, [allMessages.length, rowVirtualizer, conversationId]);

  const handleLoadMore = () => {
    if (!scrollRef.current) return;
    prevScrollHeightRef.current = rowVirtualizer.getTotalSize();
    isLoadingMoreRef.current = true;
    fetchNextPage();
  };

  // Mark as read logic
  useEffect(() => {
    if (!conversationId || !activeUser?.waId || allMessages.length === 0 || isFetching) return;

    const hasUnread = allMessages.some(
      (m) => m.to === activeUser.waId && m.status !== "read"
    );

    if (hasUnread) {
      markConversationAsRead(conversationId);
    }
  }, [conversationId, activeUser?.waId, allMessages, isFetching, markConversationAsRead]);

  return (
    <div
      ref={scrollRef}
      className="h-[80vh] w-full relative flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col"
      style={{ overscrollBehaviorX: "none", WebkitOverflowScrolling: "touch" }}
    >
      <div className="bg-gray-400 dark:bg-[url(/chat-bg.png)] bg-fixed fixed h-full w-full opacity-5 !z-0 pointer-events-none"></div>

      <div className="flex items-center justify-center py-2 z-10 top-0">
        <Button
          variant="ghost"
          onClick={handleLoadMore}
          disabled={!hasNextPage || isFetchingNextPage}
          className="text-sm"
        >
          {isFetchingNextPage ? (
            <><PlusCircle size={18} className="mr-2 animate-spin" /> Loading...</>
          ) : hasNextPage ? (
            <><PlusCircle size={18} className="mr-2" /> Load More</>
          ) : null}
        </Button>
      </div>

      {/* Virtualized Inner Container */}
      <div
        className="w-full relative z-20"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((vItem) => {
          const message = allMessages[vItem.index];
          const isSender = activeUser?.waId === message.from;
          return (
            <div
              key={vItem.key}
              ref={rowVirtualizer.measureElement}
              data-index={vItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vItem.start}px)`,
              }}
              className="px-1 sm:px-6"
            >
              <MessageBubble
                message={message}
                isSender={isSender}
                isReceiver={!isSender}
              />
            </div>
          );
        })}
      </div>

      {isFetching && <MessageLoader />}
    </div>
  );
}

export default memo(ChatContainer);

