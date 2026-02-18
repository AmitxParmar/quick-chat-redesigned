"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { EmojiClickData } from "emoji-picker-react";
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
import { Mic, Plus, SendHorizontal, Smile } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useSendMessage } from "@/hooks/useMessages";
import { useUserStore } from "@/store/user-store";
import useAuth from "@/hooks/useAuth";

import { useChatParams } from "@/hooks/use-chat-params";

function MessageBar() {
  const { conversationId } = useChatParams();
  const activeChatUser = useUserStore((state) => state.activeChatUser);
  const { user: activeUser } = useAuth();
  const { mutate: sendMessage } = useSendMessage();
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement; // Cast to HTMLElement
      if (target.id !== "emoji-open") {
        if (
          emojiPickerRef.current &&
          !emojiPickerRef.current.contains(target)
        ) {
          setEmojiPicker(false);
        }
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Focus input when emoji picker closes or after sending a message
  useEffect(() => {
    if (!showEmojiPicker && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showEmojiPicker]);

  // Handle Emoji Modal
  const handleEmojiModal = (): void => setEmojiPicker(!showEmojiPicker);

  const handleEmojiClick = (emoji: EmojiClickData) => {
    setMessage((prevMsg) => (prevMsg += emoji.emoji));
    // Focus input after emoji is picked
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  /* handle submit message */
  const handleSubmit = () => {
    if (!message.trim()) return;

    const toWaId = activeChatUser?.waId;
    if (!toWaId) return;

    const data = {
      from: activeUser.waId,
      to: toWaId,
      text: message,
      conversationId, // Include conversationId for optimistic updates
    };

    sendMessage(data, {
      onSuccess: () => {
        setMessage("");
        // Focus input after sending
        inputRef.current?.focus();

      },
    });
  };

  // Add onKeyDown handler for Enter key
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="dark:bg-message-bar shadow-sm rounded-full h-message-bar mx-3 mb-3 px-1.5 py-1 flex items-center gap-x-0.5 relative">
      <div className="flex relative items-center h-full max-w-3xs">
        <Button
          size={"icon"}
          className="size-10 flex bg-transparent text-primary items-center justify-center rounded-full hover:bg-searchbar/50 transition-colors duration-150"
          tabIndex={0}
          aria-label="Attach File"
        >
          <Plus className="text-panel-header-icon cursor-pointer size-6" />
        </Button>
        <Button
          size={"icon"}
          className="size-10 flex bg-transparent text-primary items-center justify-center rounded-full hover:bg-searchbar/50 transition-colors duration-150"
          id="emoji-open"
          tabIndex={0}
          onClick={handleEmojiModal}
          aria-label="Open Emoji Picker"
        >
          <Smile className="text-panel-header-icon cursor-pointer size-6" />
        </Button>
        {showEmojiPicker && (
          <div className="absolute bottom-24 left-16 z-40" ref={emojiPickerRef}>
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </div>
        )}
      </div>
      <div className="w-full rounded-lg h-10 flex items-center">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Type a message"
          className="border-none ring-0 placeholder:font-semibold placeholder:-tracking-normal px-1.5 placeholder:text-[15px] leading-1 focus:ring-0 focus-visible:ring-0 bg-transparent dark:bg-transparent focus:outline-none text-primary h-full rounded-lg w-full"
          onChange={(e) => setMessage(e.target.value)}
          value={message}
          onKeyDown={handleInputKeyDown}
        />
      </div>
      <div className="flex w-10 items-center justify-center">
        <button
          className={`${message === "" ? "opacity-20" : null}`}
          type="button"
          onClick={message.length ? handleSubmit : undefined}
          aria-label={message.length ? "Send Message" : "Record Voice Message"}
        >
          {message.length ? (
            <SendHorizontal className="text-panel-header-icon cursor-pointer text-xl" />
          ) : (
            <Mic className="text-panel-header-icon cursor-pointer text-xl" />
          )}
        </button>
      </div>
    </div>
  );
}

export default MessageBar;
