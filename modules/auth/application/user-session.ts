import { getUserFromRequest, type JWTPayload } from './session';

export type UserSession = {
  userId: string;
  email: string;
  role: string;
};

/**
 * Gets user session from request (via cookie)
 * Useful for API routes to authenticate users
 */
export async function getUserSessionFromRequest(request: Request): Promise<UserSession | null> {
  const payload: JWTPayload | null = await getUserFromRequest(request);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}
