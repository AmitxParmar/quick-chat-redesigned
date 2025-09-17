"use client";
import React from "react";
import Conversations from "../conversations";
import { useIsMobile } from "@/hooks/use-mobile";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";


const ChatLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  
  const { isAuthenticated, isLoading } = useAuth();

  

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-secondary">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-gray-600 font-medium">Connecting...</p>
            <p className="text-gray-400 text-sm mt-1">This may take a few minutes</p>
          </div>
        </div>
      </div>
    );
  }
  // Don't render the chat layout if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-secondary">
        <div className="text-center">
          <p className="text-gray-600 font-medium mb-4">Please log in to access the chat</p>
          <Link href="/login" className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isMobile
          ? "flex flex-col h-full w-screen max-h-screen max-w-full overflow-hidden"
          : "grid grid-cols-[1fr_2.4fr] h-full w-screen max-w-full overflow-hidden"
      }
    >
      <Conversations />
      {children}
    </div>
  );
};

export default ChatLayout;
