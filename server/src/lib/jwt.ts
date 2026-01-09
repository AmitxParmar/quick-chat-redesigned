import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import { type JwtPayload, type TokenPair } from '@/types/auth.type';

export type TokenVerifyResult =
    | { valid: true; payload: JwtPayload }
    | { valid: false; error: 'EXPIRED' | 'INVALID' };

class JwtService {
    private readonly accessSecret: Secret;
    private readonly refreshSecret: Secret;
    private readonly accessExpiresIn: string;
    private readonly refreshExpiresIn: string;

    constructor() {
        this.accessSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-key';
        this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
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

    public generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair {
        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload),
        };
    }

    // Legacy method for backward compatibility
    public verifyAccessToken(token: string): JwtPayload | null {
        try {
            return jwt.verify(token, this.accessSecret) as JwtPayload;
        } catch {
            return null;
        }
    }

    // New method with detailed error info
    public verifyAccessTokenDetailed(token: string): TokenVerifyResult {
        try {
            const payload = jwt.verify(token, this.accessSecret) as JwtPayload;
            return { valid: true, payload };
        } catch (error) {
            // Check if error is a TokenExpiredError by name (works with CJS modules)
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                return { valid: false, error: 'EXPIRED' };
            }
            return { valid: false, error: 'INVALID' };
        }
    }

    // Legacy method for backward compatibility
    public verifyRefreshToken(token: string): JwtPayload | null {
        try {
            return jwt.verify(token, this.refreshSecret) as JwtPayload;
        } catch {
            return null;
        }
    }

    // New method with detailed error info
    public verifyRefreshTokenDetailed(token: string): TokenVerifyResult {
        try {
            const payload = jwt.verify(token, this.refreshSecret) as JwtPayload;
            return { valid: true, payload };
        } catch (error) {
            // Check if error is a TokenExpiredError by name (works with CJS modules)
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                return { valid: false, error: 'EXPIRED' };
            }
            return { valid: false, error: 'INVALID' };
        }
    }

    public getRefreshExpiryMs(): number {
        const match = this.refreshExpiresIn.match(/^(\d+)([smhd])$/);
        if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's':
                return value * 1000;
            case 'm':
                return value * 60 * 1000;
            case 'h':
                return value * 60 * 60 * 1000;
            case 'd':
                return value * 24 * 60 * 60 * 1000;
            default:
                return 7 * 24 * 60 * 60 * 1000;
        }
    }
}

export default new JwtService();
