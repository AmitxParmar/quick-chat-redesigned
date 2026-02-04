"use client";
import React from "react";
import Conversations from "../conversations";
import { useIsMobile } from "@/hooks/use-mobile";
import useAuth from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const ChatLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const { isAuthenticated, isLoading } = useAuth();

  // Handle authentication redirect in useEffect to avoid render-time navigation

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full bg-green-500/10 blur-2xl animate-pulse" />
          <Loader2 className="relative h-12 w-12 animate-spin text-green-600" />
        </div>
      </div>
    )
  }

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
