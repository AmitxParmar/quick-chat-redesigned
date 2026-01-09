import { type NextFunction, type Response } from 'express';
import { type AuthRequest } from '@/types/auth.type';
import jwtService from '@/lib/jwt';
import authRepository from '@/modules/auth/auth.repository';
import { HttpUnAuthorizedError } from '@/lib/errors';

export const verifyAuthToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get access token from cookies
    const accessToken = req.cookies?.access_token;

    if (!accessToken) {
      throw new HttpUnAuthorizedError('Access token not provided', 'ACCESS_TOKEN_MISSING');
    }

    // Verify access token with detailed error info
    const result = jwtService.verifyAccessTokenDetailed(accessToken);

    if (!result.valid) {
      if (result.error === 'EXPIRED') {
        throw new HttpUnAuthorizedError('Access token has expired', 'ACCESS_TOKEN_EXPIRED');
      }
      throw new HttpUnAuthorizedError('Invalid access token', 'ACCESS_TOKEN_INVALID');
    }

    // Get user from database
    const user = await authRepository.findUserById(result.payload.userId);
    if (!user) {
      throw new HttpUnAuthorizedError('User not found', 'USER_NOT_FOUND');
    }

    // Attach user to request
    req.user = user;
    console.log(`[AuthMiddleware] Authenticated User: ${user.waId} (${user.id})`);
    next();
  } catch (error) {
    next(error);
  }
};
