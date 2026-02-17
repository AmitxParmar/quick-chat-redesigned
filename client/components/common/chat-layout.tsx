"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/hooks/use-mobile";
import useAuth from "@/hooks/useAuth";

const Conversations = dynamic(() => import("../conversations"), {
  ssr: false,
  loading: () => <div className="border-r animate-pulse bg-muted/30" />,
});

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
