import api from "@/lib/api";
import { Message } from "@/types";

const API_BASE = "/api/messages";

export interface IMessagePagination {
  currentPage: number;
  totalPages: number;
  totalMessages: number;
  hasMore: boolean;
}

export interface IMessageResponse {
  messages: Message[];
  pagination: IMessagePagination;
}

export interface IAddMessageRequest {
  from: string;
  to: string;
  text: string;
  type?: string;
}

export interface IAddMessageResponse {
  message: Message;
  conversationId: string;
}

export interface IAddImageMessageRequest {
  from: string;
  to: string;
  image: File | string;
  type?: string;
}

export interface IUpdateMessageStatusRequest {
  status: string;
}

// Fetch messages by conversation ID

export async function getMessages(
  conversationId: string,
  queries?: { page?: number; limit?: number }
) {
  const res = await api.get(`${API_BASE}/${conversationId}`, {
    params: queries,
  });
  console.log("msgs", res.data);
  return res.data.data as IMessageResponse;
}

// Add (send) a new message
export async function sendMessage(data: IAddMessageRequest) {
  const res = await api.post(API_BASE, data);
  return res.data.data as IAddMessageResponse;
}
// Add (send) an image message
export async function addImageMessage(data: IAddImageMessageRequest) {
  const res = await api.post(`${API_BASE}/image`, data);
  return res.data.data as IAddMessageResponse;
}

// Update message status
export async function updateMessageStatus(
  messageId: string,
  data: IUpdateMessageStatusRequest
) {
  const res = await api.put(`${API_BASE}/${messageId}/status`, data);
  return res.data.data as Message;
}
