import api from "@/lib/api";
import { Message } from "@/types";

const API_BASE = "/api/messages";

export interface ISendAudioMessageRequest {
  from: string;
  to: string;
  audio: File;
}

export interface ISendAudioMessageResponse {
  message: Message;
  conversationId: string;
}

export async function sendAudioMessage(data: ISendAudioMessageRequest) {
  const formData = new FormData();
  formData.append("audio", data.audio);

  const response = await api.post(`${API_BASE}/audio`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    params: {
      from: data.from,
      to: data.to,
    },
  });

  return response.data.data as ISendAudioMessageResponse;
}