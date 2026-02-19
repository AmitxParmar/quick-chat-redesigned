"use client";
import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Conversations from "../conversations";
import useAuth from "@/hooks/useAuth";
import Loader from "./loading-indicator";



const ChatLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const { isLoading } = useAuth()

  if (isLoading) {
    return <Loader />
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
