import { type User } from '@prisma/client';

/**
 * User fields that are safe to return to a client.
 *
 * `password` is the hash, and `refreshToken` is a server-side credential that
 * must never leave the API in a response body (it is delivered as an HttpOnly
 * cookie instead).
 */
export type PublicUser = Omit<User, 'password' | 'refreshToken'>;
