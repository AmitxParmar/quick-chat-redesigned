import { type NextFunction, type Request } from 'express';
import { HttpStatusCode } from 'axios';
import { type CustomResponse } from '@/types/common.type';
import { type AuthRequest } from '@/types/auth.type';
import Api from '@/lib/api';
import { cookieService } from '@/utils/cookies';
import socketService from '@/lib/socket';
import AuthService from './auth.service';
import { User } from '@prisma/client';

export default class AuthController extends Api {
  private authService: AuthService;

  constructor() {
    super();
    this.authService = new AuthService();
  }

  /**
   * POST /auth/register - Register a new user
   */
  public register = async (
    req: Request,
    res: CustomResponse<User | null>,
    next: NextFunction
  ) => {
    try {
      const result = await this.authService.register(req.body);

      // Set cookies
      cookieService.setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

      this.send(
        res,
        { user: result.user },
        HttpStatusCode.Created,
        'User registered successfully'
      );
    } catch (e) {
      next(e);
    }
  };

  /**
   * POST /auth/login - Login user
   */
  public login = async (
    req: Request,
    res: CustomResponse<User | null>,
    next: NextFunction
  ) => {
    try {
      const result = await this.authService.login(req.body);

      // Single-device login: Notify any existing sessions to logout
      socketService.emitForcedLogout(result.user.id);

      // Set cookies
      cookieService.setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

      this.send(
        res,
        { user: result.user },
        HttpStatusCode.Ok,
        'Login successful'
      );
    } catch (e) {
      next(e);
    }
  };

  /**
   * POST /auth/logout - Logout user
   */
  public logout = async (
    req: AuthRequest,
    res: CustomResponse<null>,
    next: NextFunction
  ) => {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (req.user) {
        await this.authService.logout(req.user.id, refreshToken);
      } else if (refreshToken) {
        // Try to clean up Redis even if we don't know the user, 
        // but our delete requires just the token key if we keyed it by token.
        // In AuthService.logout we take userId. 
        // We might need a "logoutByToken" or just ignore if not authenticated.
        // For now, if no user, we just clear cookies.
      }

      cookieService.clearTokenCookies(res);
      this.send(res, null, HttpStatusCode.Ok, 'Logout successful');
    } catch (e) {
      // Force clear in case of error
      cookieService.clearTokenCookies(res);
      next(e);
    }
  };

  /**
   * POST /auth/refresh-token - Refresh tokens
   */
  public refreshToken = async (
    req: Request,
    res: CustomResponse<any>,
    next: NextFunction
  ) => {
    try {
      const token = req.cookies?.refresh_token;

      if (!token) {
        cookieService.clearTokenCookies(res);
        return res.status(HttpStatusCode.Unauthorized).send({
          message: 'Refresh token not provided',
          code: 'REFRESH_TOKEN_MISSING',
          data: null,
        });
      }

      const result = await this.authService.refreshTokens(token);

      cookieService.setTokenCookies(res, result.accessToken, result.refreshToken);

      this.send(
        res,
        { user: result.user },
        HttpStatusCode.Ok,
        'Token refreshed successfully'
      );
    } catch (e) {
      cookieService.clearTokenCookies(res);
      next(e);
    }
  };

  /**
   * GET /auth/profile - Get current user
   */
  public getProfile = async (
    req: AuthRequest,
    res: CustomResponse<any>,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(HttpStatusCode.Unauthorized).json({
          message: 'User not authenticated',
          data: null,
        });
      }

      const user = await this.authService.getCurrentUser(req.user.id);

      this.send(
        res,
        user,
        HttpStatusCode.Ok,
        'Profile retrieved successfully'
      );
    } catch (e) {
      next(e);
    }
  };

  /**
   * PATCH /auth/profile - Update profile
   */
  public updateProfile = async (
    req: AuthRequest,
    res: CustomResponse<any>,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(HttpStatusCode.Unauthorized).json({
          message: 'User not authenticated',
          data: null,
        });
      }

      const user = await this.authService.updateProfile(req.user.id, req.body);

      this.send(
        res,
        { user },
        HttpStatusCode.Ok,
        'Profile updated successfully'
      );
    } catch (e) {
      next(e);
    }
  };

  /**
   * POST /auth/change-password - Change password
   */
  public changePassword = async (
    req: AuthRequest,
    res: CustomResponse<null>,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(HttpStatusCode.Unauthorized).json({
          message: 'User not authenticated',
          data: null,
        });
      }

      const { currentPassword, newPassword } = req.body;
      await this.authService.changePassword(req.user.id, currentPassword, newPassword);

      this.send(res, null, HttpStatusCode.Ok, 'Password changed successfully');
    } catch (e) {
      next(e);
    }
  };
}
