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
  conversationId?: string; // Optional for optimistic updates
}

export interface IAddMessageResponse {
  message: Message;
  conversationId: string;
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
