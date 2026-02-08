export enum SocketEvents {
    // Auth events
    AUTH_FORCED_LOGOUT = "auth:forced-logout",

    // User events
    USER_GET_STATUS = "user:get-status",
    USER_STATUS = "user:status",
    USER_ONLINE = "user:online",
    USER_OFFLINE = "user:offline",

    // Conversation events
    CONVERSATION_JOIN = "conversation:join",
    CONVERSATION_UPDATED = "conversation:updated",

    // Message events
    MESSAGE_CREATED = "message:created",
    MESSAGE_STATUS_UPDATED = "message:status-updated",
    MESSAGES_MARKED_AS_READ = "messages:marked-as-read",
    MESSAGE_SEND = "message:send",
}
