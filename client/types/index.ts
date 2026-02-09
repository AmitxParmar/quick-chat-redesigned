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

// ============================================
// Queue System Types
// ============================================

/**
 * Queue metadata for message retry and state tracking
 */
export interface QueueMetadata {
  /** Current retry attempt count (0-5) */
  retryCount: number;
  /** Unix timestamp of last send attempt */
  lastAttemptTimestamp: number;
  /** Unix timestamp when message was first queued */
  enqueuedAt: number;
  /** Last error message if any */
  error?: string;
  /** Type of error encountered */
  errorType?: 'network' | 'server' | 'timeout' | 'unknown';
}

/**
 * Extended Message type with queue metadata
 */
export interface MessageWithQueue extends Message {
  /** Queue metadata for pending/failed messages */
  queueMetadata?: QueueMetadata;
}

/**
 * Current state of the message queue
 */
export interface QueueState {
  /** Total messages in queue */
  queueSize: number;
  /** Messages currently being processed */
  activeCount: number;
  /** Messages that have failed */
  errorCount: number;
  /** Detailed pending messages */
  pendingMessages: Array<{
    messageId: string;
    retryCount: number;
    lastAttemptTimestamp: number;
    error?: string;
    status: 'pending' | 'sending' | 'sent' | 'failed';
  }>;
  /** Whether network is online */
  isOnline: boolean;
  /** Whether queue is paused */
  isPaused: boolean;
}

/**
 * Configuration for message queue
 */
export interface QueueConfig {
  /** Maximum retry attempts (default: 5) */
  maxRetries: number;
  /** Base wait time in ms (default: 1000) */
  baseWaitMs: number;
  /** Maximum wait time in ms (default: 30000) */
  maxWaitMs: number;
  /** Jitter percentage (default: 0.3 for 30%) */
  jitter: number;
  /** Concurrent message processing limit (default: 3) */
  concurrency: number;
  /** Minimum concurrency when network is poor (default: 1) */
  minConcurrency: number;
  /** Send timeout in ms (default: 10000) */
  sendTimeoutMs: number;
  /** Whether to persist queue state (default: true) */
  persistQueueState: boolean;
}

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

// ============================================
// API Response Types (matching server structure)
// ============================================

/**
 * Success response structure from the server
 * Server returns: { message: string, data: T }
 */
export interface ApiSuccessResponse<T> {
  message: string;
  data: T;
}

/**
 * Error response structure from the server error handler
 * Server returns: { success: false, message, code?, rawErrors?, stack? }
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  rawErrors?: string[];
  code?: AuthErrorCode;
  stack?: string;
}

/**
 * Auth-specific error codes returned by the server
 */
export type AuthErrorCode =
  | "ACCESS_TOKEN_MISSING"
  | "ACCESS_TOKEN_EXPIRED"
  | "ACCESS_TOKEN_INVALID"
  | "REFRESH_TOKEN_MISSING"
  | "REFRESH_TOKEN_EXPIRED"
  | "REFRESH_TOKEN_INVALID"
  | "REFRESH_TOKEN_REVOKED"
  | "USER_NOT_FOUND";

/**
 * Auth response with user data (login, register, refresh)
 */
export interface AuthUserResponse {
  user: User;
}

/**
 * Axios error with typed response data
 */
export interface AxiosAuthError {
  response?: {
    status: number;
    data?: ApiErrorResponse;
  };
  message?: string;
}

/**
 * Type guard to check if an error is an AxiosAuthError
 */
export function isAxiosAuthError(error: unknown): error is AxiosAuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as AxiosAuthError).response === "object"
  );
}
