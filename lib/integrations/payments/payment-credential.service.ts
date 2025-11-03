import { prisma } from '@/lib/db';
import type {
  CreatePaymentCredentialInput,
  UpdatePaymentCredentialInput,
} from '@/lib/validation/integrations-payments';
import { maskPaymentCredentials } from '@/lib/validation/integrations-payments';
import { encryptCredentialFields, decryptCredentialFields } from '../shared/encryption.service';
import type { PaymentCredential } from '@prisma/client';

/**
 * Service for managing payment gateway credentials
 */

export type PaymentCredentialSafe = Omit<
  PaymentCredential,
  'apiKey' | 'publicKey' | 'secretKey' | 'clientSecret'
> & {
  apiKey?: string | null;
  publicKey?: string | null;
  secretKey?: string | null;
  clientSecret?: string | null;
  _masked: boolean;
};

/**
 * Create payment credential
 */
export async function createPaymentCredential(
  data: CreatePaymentCredentialInput
): Promise<PaymentCredentialSafe> {
  // Check if gateway exists
  const gateway = await prisma.paymentGateway.findUnique({
    where: { id: data.gatewayId },
  });

  if (!gateway) {
    throw new Error('Payment gateway not found');
  }

  // Encrypt sensitive fields
  const encryptedData = encryptCredentialFields(data as Record<string, unknown>);

  const credential = await prisma.paymentCredential.create({
    data: {
      gatewayId: data.gatewayId,
      environment: data.environment,
      authType: data.authType,
      merchantId: data.merchantId || null,
      apiKey: (encryptedData.apiKey as string) || null,
      publicKey: data.publicKey || null,
      secretKey: (encryptedData.secretKey as string) || null,
      clientId: data.clientId || null,
      clientSecret: (encryptedData.clientSecret as string) || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  return maskCredential(credential);
}

/**
 * Update payment credential
 */
export async function updatePaymentCredential(
  id: string,
  data: UpdatePaymentCredentialInput
): Promise<PaymentCredentialSafe> {
  const existing = await prisma.paymentCredential.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Credential not found');
  }

  // Encrypt sensitive fields if provided
  const encryptedData = encryptCredentialFields(data as Record<string, unknown>);

  const credential = await prisma.paymentCredential.update({
    where: { id },
    data: {
      ...(data.environment ? { environment: data.environment } : {}),
      ...(data.authType ? { authType: data.authType } : {}),
      ...(data.merchantId !== undefined ? { merchantId: data.merchantId } : {}),
      ...(encryptedData.apiKey ? { apiKey: encryptedData.apiKey as string } : {}),
      ...(data.publicKey !== undefined ? { publicKey: data.publicKey } : {}),
      ...(encryptedData.secretKey ? { secretKey: encryptedData.secretKey as string } : {}),
      ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
      ...(encryptedData.clientSecret ? { clientSecret: encryptedData.clientSecret as string } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  return maskCredential(credential);
}

/**
 * Get credential by ID (masked)
 */
export async function getPaymentCredential(id: string): Promise<PaymentCredentialSafe | null> {
  const credential = await prisma.paymentCredential.findUnique({
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
export async function getPaymentCredentialDecrypted(
  id: string
): Promise<PaymentCredential | null> {
  const credential = await prisma.paymentCredential.findUnique({
    where: { id },
  });

  if (!credential) {
    return null;
  }

  const decrypted = decryptCredentialFields(credential as unknown as Record<string, unknown>);

  return decrypted as unknown as PaymentCredential;
}

/**
 * List credentials for a payment gateway
 */
export async function listPaymentCredentials(
  gatewayId: string,
  environment?: 'SANDBOX' | 'PRODUCTION',
  isActive?: boolean
): Promise<PaymentCredentialSafe[]> {
  const credentials = await prisma.paymentCredential.findMany({
    where: {
      gatewayId,
      ...(environment && { environment }),
      ...(isActive !== undefined && { isActive }),
    },
    orderBy: [{ environment: 'asc' }, { createdAt: 'desc' }],
  });

  return credentials.map(maskCredential);
}

/**
 * Get active credential for gateway and environment
 */
export async function getActivePaymentCredential(
  gatewayId: string,
  environment: string
): Promise<PaymentCredential | null> {
  const credential = await prisma.paymentCredential.findFirst({
    where: {
      gatewayId,
      environment: environment as 'SANDBOX' | 'PRODUCTION',
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!credential) {
    return null;
  }

  const decrypted = decryptCredentialFields(credential as unknown as Record<string, unknown>);
  return decrypted as unknown as PaymentCredential;
}

/**
 * Delete credential
 */
export async function deletePaymentCredential(id: string): Promise<void> {
  await prisma.paymentCredential.delete({
    where: { id },
  });
}

/**
 * Rotate credential (mark old as inactive and create new)
 */
export async function rotatePaymentCredential(
  id: string,
  newData: CreatePaymentCredentialInput
): Promise<PaymentCredentialSafe> {
  const old = await prisma.paymentCredential.findUnique({
    where: { id },
  });

  if (!old) {
    throw new Error('Credential not found');
  }

  // Mark old as inactive
  await prisma.paymentCredential.update({
    where: { id },
    data: {
      isActive: false,
    },
  });

  // Create new credential
  const newCredential = await createPaymentCredential({
    ...newData,
    gatewayId: old.gatewayId,
    environment: old.environment,
  });

  // Update lastRotatedAt on old credential
  await prisma.paymentCredential.update({
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
function maskCredential(credential: PaymentCredential): PaymentCredentialSafe {
  const masked = maskPaymentCredentials(credential as unknown as Record<string, unknown>);

  return {
    ...credential,
    ...(masked as Record<string, unknown>),
    _masked: true,
  } as PaymentCredentialSafe;
}
