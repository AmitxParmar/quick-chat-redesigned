interface User {
  id: string;
  socketId: string;
  isOnline: boolean;
  lastSeen: Date;
}

/**
 * SocketHandler - Manages user online/offline status via WebSocket connections
 * 
 * Frontend Usage Example:
 * 
 * ```javascript
 * import { io } from 'socket.io-client';
 * 
 * const socket = io('http://localhost:3000');
 * 
 * // Connect and set user online
 * socket.on('connect', () => {
 *   const userId = 'user123'; // Get from auth/context
 *   socket.emit('user-online', userId);
 * });
 * 
 * // Listen for user status changes
 * socket.on('user-status-changed', (data) => {
 *   console.log(`User ${data.userId} is now ${data.isOnline ? 'online' : 'offline'}`);
 *   // Update UI to show user status
 *   updateUserStatusInUI(data.userId, data.isOnline);
 * });
 * 
 * // Get list of online users
 * socket.emit('get-online-users');
 * socket.on('online-users', (users) => {
 *   console.log('Online users:', users);
 *   // Update UI with online users list
 *   displayOnlineUsers(users);
 * });
 * 
 * // Handle disconnection
 * socket.on('disconnect', () => {
 *   console.log('Disconnected from server');
 * });
 * ```
 * 
 * Events:
 * - Emit 'user-online' with userId to set user as online
 * - Emit 'get-online-users' to request current online users
 * - Listen to 'user-status-changed' for real-time status updates
 * - Listen to 'online-users' to receive list of online users
 */
export default class SocketHandler {
  private users: Map<string, User> = new Map();
  private io: any;

  constructor(io: any) {
    this.io = io;
    this.setupSocketEvents();
  }

  private setupSocketEvents(): void {
    this.io.on('connection', (socket: any) => {
      console.log(`SocketHandler - User connected: ${socket.id}`);

      socket.on('user-online', (userId: string) => {
        console.log(`SocketHandler - User ${userId} set online with socket ${socket.id}`);
        this.setUserOnline(userId, socket.id);
        this.broadcastUserStatus(userId, true);
      });

      socket.on('disconnect', () => {
        const user = this.findUserBySocketId(socket.id);
        if (user) {
          console.log(`SocketHandler - User ${user.id} set offline`);
          this.setUserOffline(user.id);
          this.broadcastUserStatus(user.id, false);
        }
        console.log(`SocketHandler - User disconnected: ${socket.id}`);
      });

      socket.on('get-online-users', () => {
        const onlineUsers = this.getOnlineUsers();
        console.log(`SocketHandler - Sending online users:`, onlineUsers.map(u => u.id));
        socket.emit('online-users', onlineUsers);
      });
    });
  }

  private setUserOnline(userId: string, socketId: string): void {
    console.log(`Setting user ${userId} online with socket ${socketId}`);
    this.users.set(userId, {
      id: userId,
      socketId: socketId,
      isOnline: true,
      lastSeen: new Date()
    });
    console.log(`Total users now: ${this.users.size}`, Array.from(this.users.keys()));
  }

  private setUserOffline(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      this.users.set(userId, user);
    }
  }

  private findUserBySocketId(socketId: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.socketId === socketId) {
        return user;
      }
    }
    return undefined;
  }

  private broadcastUserStatus(userId: string, isOnline: boolean): void {
    const payload = {
      userId,
      isOnline,
      timestamp: new Date()
    };
    console.log(`Broadcasting user status:`, payload);
    this.io.emit('user-status-changed', payload);
  }

  public getOnlineUsers(): User[] {
    return Array.from(this.users.values()).filter(user => user.isOnline);
  }

  public getUserStatus(userId: string): User | undefined {
    return this.users.get(userId);
  }

  public isUserOnline(userId: string): boolean {
    const user = this.users.get(userId);
    return user ? user.isOnline : false;
  }
}

