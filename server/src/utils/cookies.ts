import environment from '@/lib/environment';
import type { Response, CookieOptions } from 'express';


export class CookieService {
    private getCookieOptions(maxAge?: number): CookieOptions {
        return {
            httpOnly: true,
            secure: !environment.isDev(),
            sameSite: environment.isDev() ? 'lax' : 'none',
            maxAge,
            path: '/',
        };
    }

    public setTokenCookies(
        res: Response,
        accessToken: string,
        refreshToken: string
    ): void {
        // Access token - 15 minutes
        res.cookie('access_token', accessToken, this.getCookieOptions(15 * 60 * 1000));

        // Refresh token - 7 days
        res.cookie('refresh_token', refreshToken, this.getCookieOptions(7 * 24 * 60 * 60 * 1000));
    }

    public clearTokenCookies(res: Response): void {
        // Helper to get options without maxAge for clearing
        const options = this.getCookieOptions();

        res.clearCookie('access_token', options);
        res.clearCookie('refresh_token', options);
    }
}

export const cookieService = new CookieService();
