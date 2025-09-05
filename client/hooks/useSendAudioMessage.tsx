import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendAudioMessage, type ISendAudioMessageRequest, type ISendAudioMessageResponse } from "@/services/audio.service";
import { Conversation } from "@/types";

export function useSendAudioMessage() {
  const qc = useQueryClient();
  
  return useMutation<ISendAudioMessageResponse, unknown, ISendAudioMessageRequest>({
    mutationFn: (data) => sendAudioMessage(data),
    onSuccess: (data) => {
      // Update conversations cache - messages cache will be updated by socket
      qc.setQueryData(
        ["conversations"],
        (oldConvo: Conversation[] | undefined) => {
          if (!oldConvo) return oldConvo;
          
          // Find the conversation to update
          const idx = oldConvo.findIndex(
            (convo) => convo._id === data.conversationId
          );
          if (idx === -1) return oldConvo;

          // Update the lastMessage and move the conversation to the top
          const updatedConvo = {
            ...oldConvo[idx],
            lastMessage: {
              text: "🎵 Audio message",
              timestamp: Date.now(),
              from: data.message.from,
              status: data.message.status,
            },
          };
          
          return [
            updatedConvo,
            ...oldConvo.slice(0, idx),
            ...oldConvo.slice(idx + 1),
          ];
        }
      );
    },
  });
}