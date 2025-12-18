import crypto from 'crypto';

/**
 * Generate a random token for email verification or password reset
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token before storing in database (for security)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure token with expiry time
 */
export function generateTokenWithExpiry(hoursValid: number = 24): {
  token: string;
  hashedToken: string;
  expiry: Date;
} {
  const token = generateToken();
  const hashedToken = hashToken(token);
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursValid);

  return {
    token, // This is sent to the user
    hashedToken, // This is stored in the database
    expiry,
  };
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(expiry: Date | null): boolean {
  if (!expiry) return true;
  return new Date() > expiry;
}
