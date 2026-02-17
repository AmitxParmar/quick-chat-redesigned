import type { Socket } from "socket.io-client";
import api from "@/lib/api";

class SocketService {
    private socket: Socket | null = null;
    private static instance: SocketService | null = null;

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public getSocket(): Socket {
        if (!this.socket) {
            // Dynamic import at first use was considered but socket.io-client
            // needs to be synchronous here since callers expect a Socket back.
            // Instead we rely on the module being loaded lazily via the dynamic 
            // import of GlobalSocketListener which is the main consumer.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { io } = require("socket.io-client");

            // Extract origin from baseURL to ensure we connect to root
            let url = "http://localhost:8000";
            const apiBase = api.defaults.baseURL;

            if (apiBase) {
                try {
                    if (apiBase.startsWith("http")) {
                        const parsedUrl = new URL(apiBase);
                        url = parsedUrl.origin;
                    } else {
                        if (typeof window !== "undefined") {
                            url = window.location.origin;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing API base URL for socket:", e);
                }
            }

            console.log("[SocketService] Connecting to:", url);

            this.socket = io(url, {
                transports: ["websocket"],
                autoConnect: true,
                withCredentials: true,
                reconnection: true,
                perMessageDeflate: {
                    threshold: 1024,
                },
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            this.socket!.on("connect", () => {
                console.log("[SocketService] Connected with ID:", this.socket?.id);
            });

            this.socket!.on("connect_error", (err: Error) => {
                console.error("[SocketService] Connection error:", err.message);
            });

            this.socket!.on("disconnect", (reason: string) => {
                console.log("[SocketService] Disconnected:", reason);
            });
        }
        return this.socket!;
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Lazy singleton — don't call getInstance() at module level to avoid
// importing socket.io-client during module evaluation
let _instance: SocketService | null = null;

export function getSocketService(): SocketService {
    if (!_instance) {
        _instance = SocketService.getInstance();
    }
    return _instance;
}

// Backward-compatible export using a getter
export const socketService = {
    getSocket: () => getSocketService().getSocket(),
    disconnect: () => getSocketService().disconnect(),
};

export default socketService;
