import { Check, CheckCheck, Clock } from "lucide-react";
import React from "react";

function MessageStatus({
  messageStatus,
}: {
  messageStatus: "pending" | "sent" | "delivered" | "read" | "failed";
}) {
  return (
    <>
      {messageStatus === "pending" && <Clock className="p-0.5" size={14} />}
      {messageStatus === "sent" && <Check className="p-0.5" />}
      {messageStatus === "delivered" && <CheckCheck className="p-0.5" />}
      {messageStatus === "read" && (
        <CheckCheck className="p-0.5 text-icon-ack" />
      )}
    </>
  );
}

export default MessageStatus;
