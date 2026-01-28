import React from "react";
import MessageStatus from "@/components/common/message-status";
import { calculateTime } from "@/utils/calculateTime";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { ChevronDown } from "lucide-react";
import { Message } from "@/types";
import { formatWaIdToPhone } from "@/utils";

type MessageBubbleProps = {
  message: Message;
  isSender: boolean;
  isReceiver: boolean;
};

const MessageBubble = ({
  message,
  isSender,
  isReceiver,
}: MessageBubbleProps) => (
  <div
    className={`relative flex w-full mb-2 ${isSender ? "justify-end" : "justify-start"
      }`}
  >
    {/* Receiver side: show avatar on upper top left */}
    {isReceiver && (
      <div className="flex flex-col items-start mr-2">
        <Avatar className="size-8 border-2 mb-1">
          <AvatarFallback>{message.contact.name[0]}</AvatarFallback>
        </Avatar>
      </div>
    )}
    {/* Message bubble */}
    {message.type === "text" && (
      <div
        className={[
          "relative group text-primary px-3 py-1 text-sm max-w-[65%] shadow flex flex-col",
          isSender
            ? "bg-outgoing ml-8 rounded-tl-md rounded-b-md rounded-tr-none"
            : "bg-incoming mr-2 rounded-tr-md rounded-b-md rounded-tl-none",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0",
            isSender
              ? "right-[-8px] text-outgoing scale-x-[-1]"
              : "left-[-8px] text-incoming",
          ].join(" ")}
        >
          <svg
            viewBox="0 0 8 13"
            height="13"
            width="8"
            preserveAspectRatio="xMidYMid meet"
            className=""
            version="1.1"
            x="0px"
            y="0px"
            enableBackground="new 0 0 8 13"
          >
            <title>tail-in</title>
            <path
              opacity="0.13"
              fill="#0000000"
              d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z"
            ></path>
            <path
              fill="currentColor"
              d="M1.533,2.568L8,11.193V0L2.812,0C1.042,0,0.474,1.156,1.533,2.568z"
            ></path>
          </svg>
        </span>
        <ChevronDown
          className={` cursor-pointer absolute hidden group-hover:block top-0.5 right-2`}
        />
        {/* Optional: show name for receiver */}
        {isReceiver && (
          <div className="capitalize text-wa-info text-[11px] mt-1">
            {formatWaIdToPhone(message.from)}
          </div>
        )}
        <div className="flex gap-2 items-end ">
          <span className="break-all text-white leading-7">{message.text}</span>
          <div className="flex gap-1 items-end text-wa-info">
            <span className="text-[11px] pt-1 min-w-fit">
              {calculateTime(message?.createdAt)}
            </span>
            <span>
              {isSender && <MessageStatus messageStatus={message?.status} />}
            </span>
          </div>
        </div>
      </div>
    )}
    {/* Sender side: no avatar */}
  </div>
);

export default MessageBubble;
