import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSocketOptions {
  url?: string;
  protocols?: string | string[];
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  enabled?: boolean;
}

interface UseSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Event | null;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  close: () => void;
  reconnect: () => void;
}

// Socket keys for consistency
export const socketKeys = {
  all: ["socket"] as const,
  connection: (url: string) => [...socketKeys.all, "connection", url] as const,
};

export const useSocket = (options: UseSocketOptions = {}): UseSocketReturn => {
  const {
    url,
    protocols,
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    enabled = true
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnect = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || isConnecting || !url) return;

    try {
      setIsConnecting(true);
      setError(null);
      
      const ws = new WebSocket(url, protocols);
      ws.onopen = (event) => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
    reconnectCount.current = 0;
        onOpen?.(event);
  };

      ws.onmessage = (event) => {
        onMessage?.(event);
    };

      ws.onerror = (event) => {
        setError(event);
        setIsConnecting(false);
        onError?.(event);
  };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        onClose?.(event);
        
        if (reconnect && shouldReconnect.current && reconnectCount.current < reconnectAttempts) {
          reconnectCount.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
};
      setSocket(ws);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setIsConnecting(false);
      setError(error as Event);
    }
  }, [url, protocols, enabled, isConnecting, onOpen, onMessage, onError, onClose, reconnect, reconnectAttempts, reconnectInterval]);

  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    } else {
      console.warn('WebSocket is not connected. Cannot send data.');
    }
  }, [socket]);

  const close = useCallback(() => {
    shouldReconnect.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    socket?.close();
  }, [socket]);

  const manualReconnect = useCallback(() => {
    close();
    shouldReconnect.current = true;
    reconnectCount.current = 0;
    setTimeout(() => connect(), 100); // Small delay to ensure cleanup
  }, [close, connect]);

  useEffect(() => {
    if (enabled && url) {
      shouldReconnect.current = true;
      connect();
    }

    return () => {
      shouldReconnect.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      socket?.close();
    };
  }, [url, enabled, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket?.close();
    };
  }, []);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    send,
    close,
    reconnect: manualReconnect
  };
};
