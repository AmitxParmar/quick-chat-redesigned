"use client";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageCircle } from "lucide-react";

export default function EmptyChat() {
  const isMobile = useIsMobile();
  return (
    !isMobile && (
      <main className="flex flex-col items-center justify-center h-full text-gray-500">
        <MessageCircle className="h-24 w-24 mb-4 text-gray-300" />
        <h2 className="text-2xl font-light mb-2">WhatsApp Web</h2>
        <p className="text-center max-w-md">
          Send and receive messages without keeping your phone online. Use
          WhatsApp on up to 4 linked devices and 1 phone at the same time.
        </p>
      </main>
    )
  );
}
