import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import { type JwtPayload } from '@/types/auth.type';

export type TokenVerifyResult =
    | { valid: true; payload: JwtPayload }
    | { valid: false; error: 'EXPIRED' | 'INVALID' };

class JwtService {
    private readonly accessSecret: Secret;
    private readonly refreshSecret: Secret;
    private readonly accessExpiresIn: string;
    private readonly refreshExpiresIn: string;

    constructor() {
        if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is required');
        if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is required');
        this.accessSecret = process.env.JWT_ACCESS_SECRET;
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.accessExpiresIn = process.env.JWT_ACCESS_EXPIRY || '15m';
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRY || '7d';
    }

    public generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
        const options: SignOptions = {
            expiresIn: this.accessExpiresIn as jwt.SignOptions['expiresIn'],
        };
        return jwt.sign(payload, this.accessSecret, options);
    }

    public generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
        const options: SignOptions = {
            expiresIn: this.refreshExpiresIn as jwt.SignOptions['expiresIn'],
        };
        return jwt.sign(payload, this.refreshSecret, options);
    }

    public verifyAccessToken(token: string): JwtPayload | null {
        try {
            return jwt.verify(token, this.accessSecret) as JwtPayload;
        } catch {
            return null;
        }
    }

    public verifyAccessTokenDetailed(token: string): TokenVerifyResult {
        try {
            const payload = jwt.verify(token, this.accessSecret) as JwtPayload;
            return { valid: true, payload };
        } catch (error) {
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                return { valid: false, error: 'EXPIRED' };
            }
            return { valid: false, error: 'INVALID' };
        }
    }

    public verifyRefreshTokenDetailed(token: string): TokenVerifyResult {
        try {
            const payload = jwt.verify(token, this.refreshSecret) as JwtPayload;
            return { valid: true, payload };
        } catch (error) {
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                return { valid: false, error: 'EXPIRED' };
            }
            return { valid: false, error: 'INVALID' };
        }
    }
}

export default new JwtService();
