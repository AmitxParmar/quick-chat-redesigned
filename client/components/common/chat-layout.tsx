"use client";
import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Conversations from "../conversations";



const ChatLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();

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
