import crypto from 'crypto';

/**
 * Encryption service for sensitive credentials
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Ensure key is exactly 32 bytes
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

if (KEY_BUFFER.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

/**
 * Encrypts a plaintext string
 * Returns format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string
 * Expects format: iv:authTag:ciphertext
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const [ivHex, authTagHex, encrypted] = parts;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY_BUFFER,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypts an object's sensitive fields
 */
export function encryptCredentialFields(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'apiKey',
    'clientSecret',
    'password',
    'token',
    'secretKey',
    'accessToken',
    'refreshToken',
  ];

  const encrypted: Record<string, unknown> = { ...data };

  for (const field of sensitiveFields) {
    if (data[field] && typeof data[field] === 'string') {
      encrypted[field] = encrypt(data[field] as string);
    }
  }

  return encrypted;
}

/**
 * Decrypts an object's sensitive fields
 */
export function decryptCredentialFields(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'apiKey',
    'clientSecret',
    'password',
    'token',
    'secretKey',
    'accessToken',
    'refreshToken',
  ];

  const decrypted: Record<string, unknown> = { ...data };

  for (const field of sensitiveFields) {
    if (data[field] && typeof data[field] === 'string') {
      try {
        decrypted[field] = decrypt(data[field] as string);
      } catch {
        // If decryption fails, keep original value
        decrypted[field] = data[field];
      }
    }
  }

  return decrypted;
}
