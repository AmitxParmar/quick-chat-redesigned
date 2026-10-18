import { jest, describe, it, expect, beforeEach, type Mock } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { type User } from '@prisma/client';

// --- Mocks (factories only reference locals created inside them) ---

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/modules/auth/auth.repository', () => ({
  __esModule: true,
  default: {
    findUserByWaId: jest.fn(),
    comparePassword: jest.fn(),
    updateUser: jest.fn(),
  },
}));

jest.mock('@/lib/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

jest.mock('@/lib/jwt', () => ({
  __esModule: true,
  default: {
    generateAccessToken: jest.fn(() => 'access-token'),
    generateRefreshToken: jest.fn(() => 'refresh-token'),
  },
}));

import AuthService from '@/modules/auth/auth.service';
import authRepository from '@/modules/auth/auth.repository';
import { redis } from '@/lib/redis';
import { LoginDto } from '@/dto/user.dto';
import { HttpNotFoundError, HttpUnAuthorizedError } from '@/lib/errors';

const repo = authRepository as unknown as {
  findUserByWaId: Mock;
  comparePassword: Mock;
  updateUser: Mock;
};

const cache = redis as unknown as {
  get: Mock;
  set: Mock;
  del: Mock;
};

const fakeUser = {
  id: 'user-1',
  waId: '919999999999',
  password: 'stored-password-hash',
} as User;

describe('[Unit] - LoginDto (password is required)', () => {
  it('rejects a login body with no password', async () => {
    const dto = plainToInstance(LoginDto, { waId: '919999999999' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('password');
  });

  it('rejects a blank password', async () => {
    const dto = plainToInstance(LoginDto, { waId: '919999999999', password: '' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('password');
  });

  it('accepts a complete login body', async () => {
    const dto = plainToInstance(LoginDto, {
      waId: '919999999999',
      password: 'secret123',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('[Unit] - AuthService.login (verification cannot be skipped)', () => {
  const authService = new AuthService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unknown users with a generic 401 — no user enumeration', async () => {
    repo.findUserByWaId.mockResolvedValue(null);

    let caught: unknown;
    try {
      await authService.login({ waId: '919999999999', password: 'secret123' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HttpUnAuthorizedError);
    expect(caught).not.toBeInstanceOf(HttpNotFoundError);
    expect((caught as Error).message).toBe('Invalid credentials');
  });

  it('fails closed on an empty password even when the stored hash would match', async () => {
    repo.findUserByWaId.mockResolvedValue(fakeUser);
    repo.comparePassword.mockResolvedValue(true); // bcrypt would have said yes

    let caught: unknown;
    try {
      await authService.login({ waId: fakeUser.waId, password: '' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HttpUnAuthorizedError);
    expect(repo.comparePassword).not.toHaveBeenCalled();
  });

  it('always verifies a supplied password and rejects a mismatch', async () => {
    repo.findUserByWaId.mockResolvedValue(fakeUser);
    repo.comparePassword.mockResolvedValue(false);

    let caught: unknown;
    try {
      await authService.login({ waId: fakeUser.waId, password: 'wrong-password' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HttpUnAuthorizedError);
    expect((caught as Error).message).toBe('Invalid credentials');
    expect(repo.comparePassword).toHaveBeenCalledWith(fakeUser, 'wrong-password');
  });

  it('logs in only when the password verifies', async () => {
    repo.findUserByWaId.mockResolvedValue(fakeUser);
    repo.comparePassword.mockResolvedValue(true);
    cache.get.mockResolvedValue(null);
    repo.updateUser.mockResolvedValue(fakeUser);

    const result = await authService.login({
      waId: fakeUser.waId,
      password: 'secret123',
    });

    expect(repo.comparePassword).toHaveBeenCalledTimes(1);
    expect(repo.comparePassword).toHaveBeenCalledWith(fakeUser, 'secret123');
    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(result.user).not.toHaveProperty('password');
  });
});
