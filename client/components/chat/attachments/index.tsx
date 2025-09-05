"use client";
import { useEffect, useRef, useState } from "react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Mic, Plus, SendHorizontal, Smile, Contact, AudioLines, Video, Image } from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSendMessage } from "@/hooks/useMessages";
import { useUserStore } from "@/store/useUserStore";
import useAuth from "@/hooks/useAuth";
import { AudioRecorder } from "../audio-recorder";
import { useAudioRecorderModal } from "@/hooks/useAudioRecorderModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


function MessageBarWithAudio() {
    const { activeChatUser } = useUserStore((state) => state);
    const { user: activeUser } = useAuth();
    const { mutate: sendMessage } = useSendMessage();
    const { isOpen: showAudioRecorder, openRecorder, closeRecorder } = useAudioRecorderModal();

    const [message, setMessage] = useState("");
    const [showEmojiPicker, setEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
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
        if (!toWaId || !activeUser?.waId) return;

        const data = {
            from: activeUser.waId,
            to: toWaId,
            text: message,
        };

        sendMessage(data, {
            onSuccess: () => {
                setMessage("");
                // Focus input after sending
                inputRef.current?.focus();
                console.log("message sent successfully!");
            },
            onError: (error) => console.log(error),
        });
    };

    // Add onKeyDown handler for Enter key
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleMicClick = () => {
        if (message.length === 0) {
            openRecorder();
        }
    };

    const handleContactClick = () => {
        console.log("Contact clicked");
    };

    const handleAudioClick = () => {
        console.log("Audio clicked");
    };

    const handleVideoClick = () => {
        console.log("Video clicked");
    };

    const handleImageClick = () => {
        console.log("Image clicked");
    };

    return (
        <div className= "bg-message-bar shadow-sm rounded-full h-message-bar mx-3 mb-3 px-1.5 py-1 flex items-center gap-x-0.5 relative" >
        {!showAudioRecorder && (
            <>
            <div className="flex relative items-center h-full max-w-3xs" >
                <DropdownMenu>
                <DropdownMenuTrigger asChild >
                <Button
                  size={ "icon" }
    className = "size-10 flex bg-transparent text-primary items-center justify-center rounded-full hover:bg-searchbar/50 transition-colors duration-150"
    tabIndex = { 0}
        >
        <Plus className="text-panel-header-icon cursor-pointer size-6" />
            </Button>
            </DropdownMenuTrigger>
            < DropdownMenuContent align = "start" className = "w-48" >
                <DropdownMenuItem onClick={ handleContactClick }>
                    <Contact className="mr-2 h-4 w-4" />
                        Contact
                        </DropdownMenuItem>
                        < DropdownMenuItem onClick = { handleAudioClick } >
                            <AudioLines className="mr-2 h-4 w-4" />
                                Audio
                                </DropdownMenuItem>
                                < DropdownMenuItem onClick = { handleVideoClick } >
                                    <Video className="mr-2 h-4 w-4" />
                                        Video
                                        </DropdownMenuItem>
                                        < DropdownMenuItem onClick = { handleImageClick } >
                                            <Image className="mr-2 h-4 w-4" />
                                                Image
                                                </DropdownMenuItem>
                                                </DropdownMenuContent>
                                                </DropdownMenu>
                                                < Button
    size = { "icon"}
    className = "size-10 flex bg-transparent text-primary items-center justify-center rounded-full hover:bg-searchbar/50 transition-colors duration-150"
    id = "emoji-open"
    tabIndex = { 0}
    onClick = { handleEmojiModal }
        >
        <Smile className="text-panel-header-icon cursor-pointer size-6" />
            </Button>
    {
        showEmojiPicker && (
            <div
                className="absolute bottom-24 left-16 z-40"
        ref = { emojiPickerRef }
            >
            <EmojiPicker onEmojiClick={ handleEmojiClick } />
                </div>
            )
    }
    </div>
        < div className = "w-full rounded-lg h-10 flex items-center" >
            <Input
              ref={ inputRef }
    type = "text"
    placeholder = "Type a message"
    className = "border-none ring-0 placeholder:font-semibold placeholder:-tracking-normal px-1.5 placeholder:text-[15px] leading-1 focus:ring-0 focus-visible:ring-0 bg-transparent dark:bg-transparent focus:outline-none text-primary h-full rounded-lg w-full"
    onChange = {(e) => setMessage(e.target.value)
}
value = { message }
onKeyDown = { handleInputKeyDown }
    />
    </div>
    < div className = "flex w-10 items-center justify-center" >
        <button
              className={ `${message === "" ? "opacity-20" : null}` }
type = "button"
onClick = { message.length ? handleSubmit : handleMicClick }
    >
    {
        message.length ? (
            <SendHorizontal className= "text-panel-header-icon cursor-pointer text-xl" />
              ) : (
                <Mic className="text-panel-header-icon cursor-pointer text-xl" />
              )}
</button>
    </div>
    </>
      )}
{ showAudioRecorder && <AudioRecorder onClose={ closeRecorder } /> }
</div>
  );
}

export default MessageBarWithAudio;
