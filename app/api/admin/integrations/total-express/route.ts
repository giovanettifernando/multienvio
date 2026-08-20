// app/api/admin/integrations/total-express/route.ts

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidateTEConfigCache } from '@/platform/integrations/total-express';
import { invalidateCarrierCommissionCache } from '@/modules/quotes/application/commission';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

const TE_CARRIER_SLUG = 'total-express';

const environmentCredentialsSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  remetenteId: z.string().optional(),
  cnpj: z.string().optional(),
});

const teConfigSchema = z.object({
  activeEnvironment: z.enum(['sandbox', 'production']).default('production'),
  production: environmentCredentialsSchema.optional(),
  sandbox: environmentCredentialsSchema.optional(),
  shippingCommissionPercent: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .nullable(),
  insuranceCommissionPercent: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .nullable(),
  carrierIconPath: z.string().optional().nullable(),
});

type TEConfigInput = z.infer<typeof teConfigSchema>;

function processCredentials(
  credential: {
    username: string | null;
    password: string | null;
    customHeaders: unknown;
  } | null,
  shouldReveal: boolean
): {
  username: string;
  password: string;
  remetenteId: string;
  cnpj: string;
  passwordDecryptionFailed: boolean;
  configured: boolean;
} {
  if (!credential) {
    return { username: '', password: '', remetenteId: '', cnpj: '', passwordDecryptionFailed: false, configured: false };
  }

  const customData = (credential.customHeaders as Record<string, unknown>) || {};

  let passwordValue = '';
  let passwordDecryptionFailed = false;
  if (credential.password) {
    try {
      const decrypted = decrypt(credential.password);
      passwordValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      passwordDecryptionFailed = true;
    }
  }

  let remetenteId = '';
  if (customData.remetenteId) {
    try {
      const decrypted = decrypt(customData.remetenteId as string);
      remetenteId = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      /* ignore */
    }
  }

  let cnpj = '';
  if (customData.cnpj) {
    try {
      const decrypted = decrypt(customData.cnpj as string);
      cnpj = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      /* ignore */
    }
  }

  return {
    username: credential.username || '',
    password: passwordValue,
    remetenteId,
    cnpj,
    passwordDecryptionFailed,
    configured: !!(credential.username && credential.password && remetenteId && cnpj),
  };
}

export const GET = withApiHandler<Record<string, unknown>>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  const carrier = await prisma.carrier.findFirst({ where: { slug: TE_CARRIER_SLUG } });

  if (!carrier) {
    return {
      data: {
        configured: false,
        activeEnvironment: 'production' as 'sandbox' | 'production',
        production: { configured: false, username: '', password: '', remetenteId: '', cnpj: '' },
        sandbox: { configured: false, username: '', password: '', remetenteId: '', cnpj: '' },
        shippingCommissionPercent: null as number | null,
        insuranceCommissionPercent: null as number | null,
        carrierIconPath: null as string | null,
        status: null as string | null,
        lastUpdated: null as Date | null,
      },
    };
  }

  const [productionCred, sandboxCred] = await Promise.all([
    prisma.carrierCredential.findFirst({
      where: { carrierId: carrier.id, environment: 'PRODUCTION', isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.carrierCredential.findFirst({
      where: { carrierId: carrier.id, environment: 'SANDBOX', isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const productionData = processCredentials(productionCred, shouldReveal);
  const sandboxData = processCredentials(sandboxCred, shouldReveal);

  return {
    data: {
      configured: productionData.configured || sandboxData.configured,
      activeEnvironment: (carrier.environment === 'SANDBOX' ? 'sandbox' : 'production') as 'sandbox' | 'production',
      production: productionData,
      sandbox: sandboxData,
      shippingCommissionPercent: carrier.shippingCommissionPercent
        ? Number(carrier.shippingCommissionPercent)
        : null,
      insuranceCommissionPercent: carrier.insuranceCommissionPercent
        ? Number(carrier.insuranceCommissionPercent)
        : null,
      carrierIconPath: carrier.logoUrl || null,
      status: carrier.status as string | null,
      lastUpdated: (productionCred?.updatedAt || sandboxCred?.updatedAt || carrier.updatedAt) as Date | null,
    },
  };
});

export const POST = withApiHandler<Record<string, unknown>>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = teConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', status: 400, details: parsed.error.flatten() });
  }

  const data: TEConfigInput = parsed.data;

  const hasProdCreds = data.production?.username && data.production?.password
    && data.production?.remetenteId && data.production?.cnpj;
  const hasSandboxCreds = data.sandbox?.username && data.sandbox?.password
    && data.sandbox?.remetenteId && data.sandbox?.cnpj;

  if (!hasProdCreds && !hasSandboxCreds) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Configure ao menos um ambiente com Usuário, Senha, Remetente ID e CNPJ',
      status: 400,
    });
  }

  let carrier = await prisma.carrier.findFirst({ where: { slug: TE_CARRIER_SLUG } });

  await prisma.$transaction(async (tx) => {
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: 'Total Express',
          slug: TE_CARRIER_SLUG,
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: 'https://apis.totalexpress.com.br',
          timeout: 30000,
          maxRetries: 3,
          logoUrl: data.carrierIconPath || 'https://www.totalexpress.com.br/wp-content/uploads/2021/03/logo-total-express.png',
          description: 'Integração com APIs da Total Express',
          shippingCommissionPercent: data.shippingCommissionPercent ?? null,
          insuranceCommissionPercent: data.insuranceCommissionPercent ?? null,
        },
      });
    } else {
      carrier = await tx.carrier.update({
        where: { id: carrier.id },
        data: {
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          logoUrl: data.carrierIconPath ?? carrier.logoUrl,
          shippingCommissionPercent: data.shippingCommissionPercent ?? null,
          insuranceCommissionPercent: data.insuranceCommissionPercent ?? null,
          updatedAt: new Date(),
        },
      });
    }

    if (data.production) await saveEnvCredentials(tx, carrier.id, 'PRODUCTION', data.production);
    if (data.sandbox) await saveEnvCredentials(tx, carrier.id, 'SANDBOX', data.sandbox);
  });

  invalidateTEConfigCache();
  invalidateCarrierCommissionCache(TE_CARRIER_SLUG);

  if (!carrier) {
    throw new ApiError({ code: 'INTERNAL_ERROR', message: 'Erro ao criar/atualizar carrier', status: 500 });
  }

  return {
    data: {
      message: 'Configuração salva com sucesso',
      carrier: { id: carrier.id, slug: carrier.slug, status: carrier.status, activeEnvironment: data.activeEnvironment },
    },
  };
});

async function saveEnvCredentials(
  tx: Prisma.TransactionClient,
  carrierId: string,
  environment: 'PRODUCTION' | 'SANDBOX',
  credentials: z.infer<typeof environmentCredentialsSchema>
) {
  if (!credentials.username && !credentials.password && !credentials.remetenteId && !credentials.cnpj) return;

  const existingCred = await tx.carrierCredential.findFirst({
    where: { carrierId, environment, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  let finalPassword = credentials.password || '';
  if (credentials.password === '***' && existingCred?.password) {
    try { finalPassword = decrypt(existingCred.password); } catch { finalPassword = ''; }
  }

  let finalRemetenteId = credentials.remetenteId || '';
  if (credentials.remetenteId === '***' && existingCred?.customHeaders) {
    const existing = existingCred.customHeaders as Record<string, unknown>;
    if (existing.remetenteId) {
      try { finalRemetenteId = decrypt(existing.remetenteId as string); } catch { finalRemetenteId = existing.remetenteId as string; }
    }
  }

  let finalCnpj = credentials.cnpj || '';
  if (credentials.cnpj === '***' && existingCred?.customHeaders) {
    const existing = existingCred.customHeaders as Record<string, unknown>;
    if (existing.cnpj) {
      try { finalCnpj = decrypt(existing.cnpj as string); } catch { finalCnpj = existing.cnpj as string; }
    }
  }

  if (!credentials.username || !finalPassword || !finalRemetenteId || !finalCnpj) return;

  await tx.carrierCredential.updateMany({
    where: { carrierId, environment, isActive: true },
    data: { isActive: false },
  });

  await tx.carrierCredential.create({
    data: {
      carrierId,
      environment,
      authType: 'BASIC',
      username: credentials.username,
      password: encrypt(finalPassword),
      customHeaders: {
        remetenteId: encrypt(finalRemetenteId),
        cnpj: encrypt(finalCnpj),
      } as Prisma.InputJsonValue,
      isActive: true,
    },
  });
}
