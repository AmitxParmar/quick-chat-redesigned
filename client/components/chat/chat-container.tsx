import MessageLoader from "../common/message-loader";
import MessageBubble from "./message-bubble";
import { useMessages } from "@/hooks/useMessages";
import { useAutoMarkAsRead } from "@/hooks/useConversations";
import { memo, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, XCircle } from "lucide-react";
import useAuth from "./../../hooks/useAuth";

/**
 * ChatContainer with WhatsApp-like scroll behavior:
 * - Messages are displayed oldest at top, newest at bottom
 * - Auto-scrolls to bottom when new messages arrive
 * - "Load More" button appears at the top to fetch older messages
 * - Maintains scroll position when loading more messages
 */
function ChatContainer({ conversationId }: { conversationId: string }) {
  const { data, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);
  const { user: activeUser } = useAuth();
  const { markConversationAsRead } = useAutoMarkAsRead();

  // Ref for the scrollable container
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track previous scroll height for scroll restoration after loading more
  const prevScrollHeightRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);

  // Memoize the rendered message bubbles for performance
  // Backend now returns newest first (descending), so we need to:
  // 1. Reverse pages order (oldest page first)
  // 2. Reverse messages within each page (oldest message first)
  const messageBubbles = useMemo(() => {
    if (!data?.pages || data.pages.length === 0) return null;

    // Reverse pages so oldest page is first, then reverse messages in each page
    const allMessages = [...data.pages]
      .reverse()
      .flatMap((page) => [...page.messages].reverse());

    return allMessages.map((message, index) => {
      const isSender = activeUser?.waId === message.from;
      const isReceiver = !isSender;
      return (
        <MessageBubble
          key={message._id + index}
          message={message}
          isSender={isSender}
          isReceiver={isReceiver}
        />
      );
    });
  }, [data?.pages, activeUser?.waId]);

  // Extracted dependencies for useEffect to satisfy exhaustive-deps
  const pagesLength = data?.pages?.length;
  const lastPageMessagesLength = data?.pages?.[data.pages.length - 1]?.messages?.length;

  // Auto-scroll to bottom on initial load and when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // If we just loaded more messages, restore scroll position
    if (isLoadingMoreRef.current) {
      const newScrollHeight = el.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      el.scrollTop = scrollDiff;
      isLoadingMoreRef.current = false;
      return;
    }

    // Otherwise, scroll to bottom (for initial load or new messages)
    el.scrollTop = el.scrollHeight;
  }, [conversationId, pagesLength, lastPageMessagesLength]);

  // Handle load more - save scroll height before fetching
  const handleLoadMore = () => {
    if (!scrollRef.current) return;
    prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    isLoadingMoreRef.current = true;
    fetchNextPage();
  };

  // Fix: Only call markConversationAsRead when there are unread messages and not fetching, and only once per conversationId
  const hasMarkedAsReadRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      !conversationId ||
      !activeUser?.waId ||
      !data?.pages ||
      data.pages.length === 0 ||
      isFetching ||
      hasMarkedAsReadRef.current.has(conversationId)
    ) {
      return;
    }

    // Check if there are any unread messages for the current user
    const hasUnreadMessages = data.pages.some((page) =>
      page.messages.some(
        (message) => message.to === activeUser.waId && message.status !== "read"
      )
    );

    if (hasUnreadMessages) {
      hasMarkedAsReadRef.current.add(conversationId);
      markConversationAsRead(conversationId);
    }
  }, [
    conversationId,
    activeUser?.waId,
    data?.pages,
    isFetching,
    markConversationAsRead,
  ]);

  return (
    <div
      ref={scrollRef}
      className="
      transition-all
        h-[80vh] w-full relative flex-grow
        overflow-y-auto
        overflow-x-hidden
        custom-scrollbar
        bg-background
        flex flex-col
      "
      style={{
        overscrollBehaviorX: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="bg-[url(/chat-bg.png)] bg-fixed fixed h-full w-full opacity-5 !z-0 pointer-events-none"></div>

      {/* Load More Button at the top */}
      <div className="flex items-center justify-center py-2 z-10 sticky top-0 bg-background/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          onClick={handleLoadMore}
          disabled={!hasNextPage || isFetchingNextPage}
          className="text-sm"
        >
          {isFetchingNextPage ? (
            <>
              <span className="mr-2 animate-spin">
                <PlusCircle size={18} />
              </span>
              Loading more...
            </>
          ) : hasNextPage ? (
            <>
              <PlusCircle size={18} className="mr-2" />
              Load More
            </>
          ) : null}
        </Button>
      </div>

      {/* Message bubbles - oldest at top, newest at bottom */}
      <div className="flex-1 flex flex-col justify-start w-full gap-1 px-1 sm:px-8 max-w-full relative z-20">
        {messageBubbles}
      </div>

      {/* Loader for isFetching */}
      {isFetching && <MessageLoader />}
    </div>
  );
}

export default memo(ChatContainer);

