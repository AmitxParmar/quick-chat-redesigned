import { type User } from '@prisma/client';
import { type Request } from 'express';

export interface JwtPayload {
    userId: string;
    email?: string;
    iat?: number;
    exp?: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface AuthRequest extends Request {
    user?: Omit<User, 'passwordHash'>;
}

export interface SessionData {
    userId: string;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
}

export type SafeUser = Omit<User, 'passwordHash'>;
