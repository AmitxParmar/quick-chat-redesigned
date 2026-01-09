export type MessagePage = {
  messages: Message[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalMessages: number;
    hasMore: boolean;
  };
};
export type Participant = {
  waId: string;
  name: string;
  profilePicture?: string;
};

export type LastMessage = {
  text: string;
  timestamp: number;
  from: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
};

export type Conversation = {
  id: string;
  conversationId: string;
  participants: Participant[];
  lastMessage: LastMessage;
  unreadCount: number;
  isArchived: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type Message = {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  type: "text" | "image" | "document" | "audio" | "video";
  waId: string;
  direction: "incoming" | "outgoing";
  contact: {
    name: string;
    waId: string;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
};

// Contact type based on the provided array of objects
export type Contact = {
  id: string;
  waId: string;
  name: string;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id?: string;
  waId: string;
  name?: string;
  profilePicture?: string;
  status?: string;
  lastSeen?: Date | string;
  isOnline: boolean;
  password?: string;
  refreshToken?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};
