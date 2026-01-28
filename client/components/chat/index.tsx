"use client";
import ChatHeader from "./chat-header";
import ChatContainer from "./chat-container";
import MessageBar from "./message-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useChatParams } from "@/hooks/use-chat-params";
import { useSyncActiveUser } from "@/hooks/use-sync-active-user";

function Chat() {
  const { activeChatUserId } = useChatParams();

  // Logic extracted to hook
  useSyncActiveUser(activeChatUserId);

  const isMobile = useIsMobile();

  return (
    <div
      className={cn("w-screen md:w-full", isMobile ? "grid grid-cols-2" : "")}
    >
      <div className="w-screen lg:w-full flex flex-col h-screen z-10">
        <ChatHeader />
        <ChatContainer />
        <MessageBar />
      </div>
    </div>
  );
}

export default Chat;
