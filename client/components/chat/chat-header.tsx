import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react";
import { SocketEvents } from "@/types/socket-events";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { useEffect, useState, useMemo } from "react";
import socketService from "@/services/socket.service";

function ChatHeader() {
  const router = useRouter();
  const activeChatUser = useUserStore((state) => state.activeChatUser);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    if (!activeChatUser?.waId) return;

    const socket = socketService.getSocket();

    // Reset state when user changes
    setIsOnline(false);
    setLastSeen(null);

    // Initial status check
    socket.emit(SocketEvents.USER_GET_STATUS, { waId: activeChatUser.waId });

    const handleStatus = (data: { waId: string; isOnline: boolean; lastSeen?: number }) => {
      if (data.waId === activeChatUser.waId) {
        setIsOnline(data.isOnline);
        if (data.lastSeen) setLastSeen(data.lastSeen);
      }
    };

    const handleOnline = (data: { waId: string }) => {
      if (data.waId === activeChatUser.waId) {
        setIsOnline(true);
      }
    };

    const handleOffline = (data: { waId: string; lastSeen: number }) => {
      if (data.waId === activeChatUser.waId) {
        setIsOnline(false);
        setLastSeen(data.lastSeen);
      }
    };

    socket.on(SocketEvents.USER_STATUS, handleStatus);
    socket.on(SocketEvents.USER_ONLINE, handleOnline);
    socket.on(SocketEvents.USER_OFFLINE, handleOffline);

    return () => {
      socket.off(SocketEvents.USER_STATUS, handleStatus);
      socket.off(SocketEvents.USER_ONLINE, handleOnline);
      socket.off(SocketEvents.USER_OFFLINE, handleOffline);
    };
  }, [activeChatUser?.waId]);

  const handleBack = () => {
    router.back();
  };

  const formattedLastSeen = useMemo(() => {
    if (isOnline) return "Online";
    if (!lastSeen) return "Offline";

    const date = new Date(lastSeen);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }, [isOnline, lastSeen]);

  return (
    <header className="h-16 w-full px-4 py-3 flex items-center z-10 shadow-sm bg-background">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ArrowLeft
            onClick={handleBack}
            className="cursor-pointer lg:hidden"
          />
          <div className="flex items-center min-w-0">
            <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
              <AvatarFallback>{activeChatUser?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-primary text-sm truncate max-w-[120px] sm:max-w-none">
                {activeChatUser?.name}
              </h2>
              <p className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                {formattedLastSeen}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Button variant="ghost" size="sm" className="p-2 sm:p-2">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2 sm:p-2">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2 sm:p-2">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default ChatHeader;
