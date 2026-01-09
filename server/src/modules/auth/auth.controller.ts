import { type NextFunction, type Request } from 'express';
import { HttpStatusCode } from 'axios';
import { type CustomResponse } from '@/types/common.type';
import { type AuthRequest } from '@/types/auth.type';
import Api from '@/lib/api';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwtService from '@/lib/jwt';
import { cookieService } from '@/utils/cookies';
import { User } from '@prisma/client';

/**
 * Normalize WhatsApp ID (add 91 prefix if missing)
 */
const normalizeWaId = (waId: string): string => {
  return waId.startsWith('91') ? waId : `91${waId}`;
};

export default class AuthController extends Api {
  /**
   * POST /auth/register - Register a new user
   */
  public register = async (
    req: Request,
    res: CustomResponse<User | null>,
    next: NextFunction
  ) => {
    try {
      const { waId, name, password } = req.body;

      const normalizedWaId = normalizeWaId(waId);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { waId: normalizedWaId },
      });

      if (existingUser) {
        return res.status(HttpStatusCode.Conflict).json({
          message: 'User already exists',
          data: null,
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          waId: normalizedWaId,
          name: name || `User ${waId}`,
          password: passwordHash,
          isOnline: true,
        },
      });

      // Generate tokens
      const accessToken = jwtService.generateAccessToken({ userId: user.id });
      const refreshToken = jwtService.generateRefreshToken({ userId: user.id });

      // Save refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      // Set cookies
      cookieService.setTokenCookies(res, accessToken, refreshToken);

      this.send(
        res,
        {
          user: {
            id: user.id,
            waId: user.waId,
            name: user.name,
            profilePicture: user.profilePicture,
            status: user.status,
            isOnline: user.isOnline,
          },
        },
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
      const { waId, password } = req.body;

      const normalizedWaId = normalizeWaId(waId);
      console.log('[Login] Normalized waId:', normalizedWaId);

      // Find user
      const user = await prisma.user.findUnique({
        where: { waId: normalizedWaId },
      });

      if (!user) {
        console.log('[Login] User not found with waId:', normalizedWaId);
        return res.status(HttpStatusCode.NotFound).json({
          message: 'User not found',
          data: null,
        });
      }

      console.log('[Login] User found:', user.id);

      // Verify password if provided
      if (password) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          console.log('[Login] Invalid password');
          return res.status(HttpStatusCode.Unauthorized).json({
            message: 'Invalid password',
            data: null,
          });
        }
      }

      // Generate tokens
      const accessToken = jwtService.generateAccessToken({ userId: user.id });
      const refreshToken = jwtService.generateRefreshToken({ userId: user.id });

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isOnline: true,
          lastSeen: new Date(),
          refreshToken,
        },
      });

      // Set cookies
      cookieService.setTokenCookies(res, accessToken, refreshToken);

      this.send(
        res,
        {
          user: {
            id: user.id,
            waId: user.waId,
            name: user.name,
            profilePicture: user.profilePicture,
            status: user.status,
            isOnline: user.isOnline,
          },
        },
        HttpStatusCode.Ok,
        'Login successful'
      );
    } catch (e) {
      console.error('[Login] Error:', e);
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
      const token = req.cookies?.refresh_token;

      if (token) {
        try {
          const result = jwtService.verifyRefreshTokenDetailed(token);
          if (result.valid && result.payload) {
            await prisma.user.update({
              where: { id: result.payload.userId },
              data: {
                refreshToken: null,
                isOnline: false,
                lastSeen: new Date(),
              },
            });
          }
        } catch (error) {
          console.log('Invalid token during logout, clearing cookies anyway');
        }
      }

      cookieService.clearTokenCookies(res);
      this.send(res, null, HttpStatusCode.Ok, 'Logout successful');
    } catch (e) {
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

      const result = jwtService.verifyRefreshTokenDetailed(token);

      if (!result.valid) {
        cookieService.clearTokenCookies(res);
        return res.status(HttpStatusCode.Forbidden).send({
          message:
            result.error === 'EXPIRED'
              ? 'Refresh token expired'
              : 'Invalid refresh token',
          code:
            result.error === 'EXPIRED'
              ? 'REFRESH_TOKEN_EXPIRED'
              : 'REFRESH_TOKEN_INVALID',
          data: null,
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: result.payload.userId },
      });

      if (!user || user.refreshToken !== token) {
        cookieService.clearTokenCookies(res);
        return res.status(HttpStatusCode.Forbidden).send({
          message: 'Invalid refresh token',
          code: 'REFRESH_TOKEN_INVALID',
          data: null,
        });
      }

      // Generate new tokens
      const accessToken = jwtService.generateAccessToken({ userId: user.id });
      const newRefreshToken = jwtService.generateRefreshToken({ userId: user.id });

      // Update refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      cookieService.setTokenCookies(res, accessToken, newRefreshToken);

      this.send(
        res,
        {
          user: {
            id: user.id,
            waId: user.waId,
            name: user.name,
            profilePicture: user.profilePicture,
            status: user.status,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
          },
        },
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

      this.send(
        res,
        {
          id: req.user.id,
          waId: req.user.waId,
          name: req.user.name,
          profilePicture: req.user.profilePicture,
          status: req.user.status,
          isOnline: req.user.isOnline,
          lastSeen: req.user.lastSeen,
        },
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

      const { name, profilePicture, status } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
      if (status !== undefined) updateData.status = status;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
      });

      this.send(
        res,
        {
          user: {
            id: user.id,
            waId: user.waId,
            name: user.name,
            profilePicture: user.profilePicture,
            status: user.status,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
          },
        },
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

      if (!currentPassword || !newPassword) {
        return res.status(HttpStatusCode.BadRequest).json({
          message: 'Current password and new password are required',
          data: null,
        });
      }

      if (newPassword.length < 6) {
        return res.status(HttpStatusCode.BadRequest).json({
          message: 'New password must be at least 6 characters long',
          data: null,
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return res.status(HttpStatusCode.NotFound).json({
          message: 'User not found',
          data: null,
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(HttpStatusCode.Unauthorized).json({
          message: 'Current password is incorrect',
          data: null,
        });
      }

      // Hash and update new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newPasswordHash },
      });

      this.send(res, null, HttpStatusCode.Ok, 'Password changed successfully');
    } catch (e) {
      next(e);
    }
  };
}
