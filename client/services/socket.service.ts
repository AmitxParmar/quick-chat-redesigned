import { io, type Socket } from "socket.io-client";
import api from "@/lib/api";

class SocketService {
    private socket: Socket | null = null;
    private static instance: SocketService;

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public getSocket(): Socket {
        if (!this.socket) {
            // Extract origin from baseURL to ensure we connect to root
            // api.defaults.baseURL is like "http://localhost:8000/api/v1/development"
            // We want "http://localhost:8000"
            let url = "http://localhost:8000";
            const apiBase = api.defaults.baseURL;

            if (apiBase) {
                try {
                    // If apiBase is a full URL, parse it
                    if (apiBase.startsWith("http")) {
                        const parsedUrl = new URL(apiBase);
                        url = parsedUrl.origin;
                    } else {
                        // If it's relative, just assume current origin (window.location.origin in browser)
                        // But for SSR safety or if apiBase is just path
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
                // Disable HTTP polling compression on the client

                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            this.socket.on("connect", () => {
                console.log("[SocketService] Connected with ID:", this.socket?.id);
            });

            this.socket.on("connect_error", (err) => {
                console.error("[SocketService] Connection error:", err.message);
            });

            this.socket.on("disconnect", (reason) => {
                console.log("[SocketService] Disconnected:", reason);
            });
        }
        return this.socket;
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

export const socketService = SocketService.getInstance();
export default socketService;
