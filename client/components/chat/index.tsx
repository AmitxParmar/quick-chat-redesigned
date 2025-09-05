"use client";
import ChatHeader from "./chat-header";
import ChatContainer from "./chat-container";
import MessageBar from "./message-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import MessageBarWithAudio from "./message-bar-with-audio";

function Chat({
  conversationId,
  activeChatUserId,
}: {
  conversationId: string;
  activeChatUserId: string;
}) {
  const { setActiveChatUserById } = useUserStore((state) => state);
  const isMobile = useIsMobile();

  useEffect(() => {
    setActiveChatUserById(activeChatUserId);
  }, [activeChatUserId]);

  return (
    <div
      className={cn("w-screen md:w-full", isMobile ? "grid grid-cols-2" : "")}
    >
      <div className="w-screen lg:w-full flex flex-col h-screen z-10">
        <ChatHeader />
        <ChatContainer conversationId={conversationId} />
        <MessageBarWithAudio />
      </div>
    </div>
  );
}

export default Chat;
