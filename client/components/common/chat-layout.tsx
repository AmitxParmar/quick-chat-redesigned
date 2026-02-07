"use client";
import React from "react";
import Conversations from "../conversations";
import { useIsMobile } from "@/hooks/use-mobile";
import useAuth from "@/hooks/useAuth";

const ChatLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();

  // Don't render the chat layout if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className={
        isMobile
          ? "flex flex-col h-[100dvh] w-screen max-w-full overflow-hidden"
          : "grid grid-cols-[1fr_2.4fr] h-[100dvh] w-screen max-w-full overflow-hidden"
      }
    >
      <Conversations />
      {children}
    </div>
  );
};

export default ChatLayout;
