import { type User } from '@prisma/client';
import authRepository from './auth.repository';
import jwtService from '@/lib/jwt';
import { HttpUnAuthorizedError, HttpBadRequestError, HttpNotFoundError } from '@/lib/errors';
import logger from '@/lib/logger';

export interface RegisterInput {
  waId: string;
  name?: string;
  password: string;
}

export interface LoginInput {
  waId: string;
  password?: string;
}

export interface AuthResult {
  user: Omit<User, 'password'>;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Normalize WhatsApp ID (add 91 prefix if missing)
 */
const normalizeWaId = (waId: string): string => {
  return waId.startsWith('91') ? waId : `91${waId}`;
};

export default class AuthService {
  /**
   * Register a new user
   */
  public async register(data: RegisterInput): Promise<AuthResult> {
    const normalizedWaId = normalizeWaId(data.waId);
    logger.info(`User registration attempt: ${normalizedWaId}`);

    // Check if user already exists
    const existingUser = await authRepository.findUserByWaId(normalizedWaId);
    if (existingUser) {
      throw new HttpBadRequestError('User already exists', [
        'A user with this WhatsApp ID already exists',
      ]);
    }

    // Validate password
    if (!data.password || data.password.length < 6) {
      throw new HttpBadRequestError('Invalid password', [
        'Password must be at least 6 characters long',
      ]);
    }

    // Create user
    const user = await authRepository.createUser({
      waId: normalizedWaId,
      name: data.name,
      password: data.password,
    });

    // Generate tokens
    const accessToken = jwtService.generateAccessToken({ userId: user.id });
    const refreshToken = jwtService.generateRefreshToken({ userId: user.id });

    // Save refresh token to user
    await authRepository.updateUser(user.id, {
      refreshToken,
      isOnline: true,
    });

    logger.info(`User registered successfully: ${user.id}`);

    // Remove password from response
    const { password, ...safeUser } = user;
    return {
      user: safeUser,
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Login user
   */
  public async login(data: LoginInput): Promise<AuthResult> {
    const normalizedWaId = normalizeWaId(data.waId);
    logger.info(`User login attempt: ${normalizedWaId}`);

    // Find user
    const user = await authRepository.findUserByWaId(normalizedWaId);
    if (!user) {
      throw new HttpNotFoundError('User not found');
    }

    // Verify password (if provided - for backward compatibility)
    if (data.password) {
      const isPasswordValid = await authRepository.comparePassword(
        user,
        data.password
      );
      if (!isPasswordValid) {
        throw new HttpUnAuthorizedError('Invalid password');
      }
    }

    // Generate tokens
    const accessToken = jwtService.generateAccessToken({ userId: user.id });
    const refreshToken = jwtService.generateRefreshToken({ userId: user.id });

    // Update user status and save refresh token
    await authRepository.updateUser(user.id, {
      isOnline: true,
      lastSeen: new Date(),
      refreshToken,
    });

    logger.info(`User logged in successfully: ${user.id}`);

    // Remove password from response
    const { password, ...safeUser } = user;
    return {
      user: safeUser,
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Logout user
   */
  public async logout(userId: string): Promise<void> {
    logger.info(`User logout: ${userId}`);

    await authRepository.updateUser(userId, {
      isOnline: false,
      lastSeen: new Date(),
      refreshToken: null,
    });
  }

  /**
   * Refresh tokens
   */
  public async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'password'>;
  }> {
    // Verify refresh token
    const result = jwtService.verifyRefreshTokenDetailed(refreshToken);

    if (!result.valid) {
      if (result.error === 'EXPIRED') {
        throw new HttpUnAuthorizedError(
          'Refresh token has expired',
          'REFRESH_TOKEN_EXPIRED'
        );
      }
      throw new HttpUnAuthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }

    const payload = result.payload;

    // Find user and check if refresh token matches
    const user = await authRepository.findUserById(payload.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new HttpUnAuthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }

    // Generate new tokens
    const newAccessToken = jwtService.generateAccessToken({ userId: user.id });
    const newRefreshToken = jwtService.generateRefreshToken({ userId: user.id });

    // Update refresh token in database
    await authRepository.updateUser(user.id, {
      refreshToken: newRefreshToken,
    });

    logger.info(`Tokens refreshed successfully: ${user.id}`);

    // Remove password from response
    const { password, ...safeUser } = user;
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: safeUser,
    };
  }

  /**
   * Get current user
   */
  public async getCurrentUser(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await authRepository.findUserById(userId);
    if (!user) return null;

    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Update profile
   */
  public async updateProfile(
    userId: string,
    data: {
      name?: string;
      profilePicture?: string;
      status?: string;
    }
  ): Promise<Omit<User, 'password'>> {
    const updatedUser = await authRepository.updateUser(userId, data);

    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  /**
   * Change password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new HttpBadRequestError('Invalid password', [
        'New password must be at least 6 characters long',
      ]);
    }

    // Get user and verify current password
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new HttpNotFoundError('User not found');
    }

    const isPasswordValid = await authRepository.comparePassword(user, currentPassword);
    if (!isPasswordValid) {
      throw new HttpUnAuthorizedError('Current password is incorrect');
    }

    // Update password
    await authRepository.updatePassword(userId, newPassword);

    logger.info(`Password changed successfully: ${userId}`);
  }
}
