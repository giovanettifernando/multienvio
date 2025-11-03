import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  CreateCarrierCredentialInput,
  UpdateCarrierCredentialInput,
} from '@/lib/validation/integrations-carriers';
import { validateCarrierRules, maskCredentials } from '@/lib/validation/integrations-carriers';
import { encryptCredentialFields, decryptCredentialFields } from '../shared/encryption.service';
import type { CarrierCredential } from '@prisma/client';

/**
 * Service for managing carrier credentials
 */

export type CarrierCredentialSafe = Omit<
  CarrierCredential,
  'apiKey' | 'clientSecret' | 'password' | 'token' | 'accessToken' | 'refreshToken'
> & {
  apiKey?: string | null;
  clientSecret?: string | null;
  password?: string | null;
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  _masked: boolean;
};

/**
 * Create carrier credential
 */
export async function createCarrierCredential(
  data: CreateCarrierCredentialInput
): Promise<CarrierCredentialSafe> {
  // Validate required fields for auth type
  if (!validateCarrierRules.validateCredentialFields(data.authType, data)) {
    throw new Error(`Missing required fields for auth type: ${data.authType}`);
  }

  // Check if carrier exists
  const carrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId },
  });

  if (!carrier) {
    throw new Error('Carrier not found');
  }

  // Encrypt sensitive fields
  const encryptedData = encryptCredentialFields(data as Record<string, unknown>);

  const credential = await prisma.carrierCredential.create({
    data: {
      carrierId: data.carrierId,
      environment: data.environment,
      authType: data.authType,
      apiKey: (encryptedData.apiKey as string) || null,
      clientId: data.clientId || null,
      clientSecret: (encryptedData.clientSecret as string) || null,
      username: data.username || null,
      password: (encryptedData.password as string) || null,
      token: (encryptedData.token as string) || null,
      tokenUrl: data.tokenUrl || null,
      scope: data.scope || null,
      accessToken: (encryptedData.accessToken as string) || null,
      refreshToken: (encryptedData.refreshToken as string) || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      customHeaders: (data.customHeaders as Prisma.InputJsonValue) ?? undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  return maskCredential(credential);
}

/**
 * Update carrier credential
 */
export async function updateCarrierCredential(
  id: string,
  data: UpdateCarrierCredentialInput
): Promise<CarrierCredentialSafe> {
  const existing = await prisma.carrierCredential.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Credential not found');
  }

  // Encrypt sensitive fields if provided
  const encryptedData = encryptCredentialFields(data as Record<string, unknown>) as Record<string, unknown>;

  const credential = await prisma.carrierCredential.update({
    where: { id },
    data: {
      ...(data.environment ? { environment: data.environment } : {}),
      ...(data.authType ? { authType: data.authType } : {}),
      ...(encryptedData.apiKey ? { apiKey: encryptedData.apiKey as string } : {}),
      ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
      ...(encryptedData.clientSecret ? { clientSecret: encryptedData.clientSecret as string } : {}),
      ...(data.username !== undefined ? { username: data.username } : {}),
      ...(encryptedData.password ? { password: encryptedData.password as string } : {}),
      ...(encryptedData.token ? { token: encryptedData.token as string } : {}),
      ...(data.tokenUrl !== undefined ? { tokenUrl: data.tokenUrl } : {}),
      ...(data.scope !== undefined ? { scope: data.scope } : {}),
      ...(encryptedData.accessToken ? { accessToken: encryptedData.accessToken as string } : {}),
      ...(encryptedData.refreshToken ? { refreshToken: encryptedData.refreshToken as string } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
      ...(data.customHeaders !== undefined ? { customHeaders: data.customHeaders as Prisma.InputJsonValue } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  return maskCredential(credential);
}

/**
 * Get credential by ID (masked)
 */
export async function getCarrierCredential(id: string): Promise<CarrierCredentialSafe | null> {
  const credential = await prisma.carrierCredential.findUnique({
    where: { id },
  });

  if (!credential) {
    return null;
  }

  return maskCredential(credential);
}

/**
 * Get credential by ID (unmasked - for internal use only)
 */
export async function getCarrierCredentialDecrypted(
  id: string
): Promise<CarrierCredential | null> {
  const credential = await prisma.carrierCredential.findUnique({
    where: { id },
  });

  if (!credential) {
    return null;
  }

  const decrypted = decryptCredentialFields(credential as unknown as Record<string, unknown>);

  return decrypted as unknown as CarrierCredential;
}

/**
 * List credentials for a carrier
 */
export async function listCarrierCredentials(
  carrierId: string,
  environment?: 'SANDBOX' | 'PRODUCTION',
  isActive?: boolean
): Promise<CarrierCredentialSafe[]> {
  const credentials = await prisma.carrierCredential.findMany({
    where: {
      carrierId,
      ...(environment && { environment }),
      ...(isActive !== undefined && { isActive }),
    },
    orderBy: [{ environment: 'asc' }, { createdAt: 'desc' }],
  });

  return credentials.map(maskCredential);
}

/**
 * Get active credential for carrier and environment
 */
export async function getActiveCarrierCredential(
  carrierId: string,
  environment: string
): Promise<CarrierCredential | null> {
  const credential = await prisma.carrierCredential.findFirst({
    where: {
      carrierId,
      environment: environment as 'SANDBOX' | 'PRODUCTION',
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!credential) {
    return null;
  }

  const decrypted = decryptCredentialFields(credential as unknown as Record<string, unknown>);
  return decrypted as unknown as CarrierCredential;
}

/**
 * Delete credential
 */
export async function deleteCarrierCredential(id: string): Promise<void> {
  await prisma.carrierCredential.delete({
    where: { id },
  });
}

/**
 * Rotate credential (mark old as inactive and create new)
 */
export async function rotateCarrierCredential(
  id: string,
  newData: CreateCarrierCredentialInput
): Promise<CarrierCredentialSafe> {
  const old = await prisma.carrierCredential.findUnique({
    where: { id },
  });

  if (!old) {
    throw new Error('Credential not found');
  }

  // Mark old as inactive
  await prisma.carrierCredential.update({
    where: { id },
    data: {
      isActive: false,
    },
  });

  // Create new credential
  const newCredential = await createCarrierCredential({
    ...newData,
    carrierId: old.carrierId,
    environment: old.environment,
  });

  // Update lastRotatedAt on old credential
  await prisma.carrierCredential.update({
    where: { id },
    data: {
      lastRotatedAt: new Date(),
    },
  });

  return newCredential;
}

/**
 * Mask sensitive credential fields
 */
function maskCredential(credential: CarrierCredential): CarrierCredentialSafe {
  const masked = maskCredentials(credential as unknown as Record<string, unknown>);

  return {
    ...credential,
    ...(masked as Record<string, unknown>),
    _masked: true,
  } as CarrierCredentialSafe;
}
