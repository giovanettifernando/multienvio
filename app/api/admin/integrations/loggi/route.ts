/**
 * GET /api/admin/integrations/loggi
 * POST /api/admin/integrations/loggi
 *
 * Rotas de configuração da integração Loggi (Admin)
 * Suporta credenciais separadas para Produção e Sandbox
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidateLoggiConfigCache } from '@/platform/integrations/loggi';
import { invalidateCarrierCommissionCache } from '@/modules/quotes/application/commission';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

const LOGGI_CARRIER_SLUG = 'loggi';

/**
 * Schema de credenciais para um ambiente específico
 */
const environmentCredentialsSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  companyId: z.string().optional(),
});

/**
 * Schema de validação para configuração da Loggi
 */
const loggiConfigSchema = z.object({
  activeEnvironment: z.enum(['sandbox', 'production']).default('sandbox'),
  production: environmentCredentialsSchema.optional(),
  sandbox: environmentCredentialsSchema.optional(),
  shippingCommissionPercent: z
    .number()
    .min(0, 'Comissão não pode ser negativa')
    .max(100, 'Comissão não pode exceder 100%')
    .optional()
    .nullable(),
  carrierIconPath: z.string().optional().nullable(),
});

type LoggiConfigInput = z.infer<typeof loggiConfigSchema>;

/**
 * Helper para processar credenciais de um ambiente
 */
function processCredentials(
  credential: {
    clientId: string | null;
    password: string | null;
    customHeaders: unknown;
  } | null,
  shouldReveal: boolean
): {
  clientId: string;
  clientSecret: string;
  companyId: string;
  configured: boolean;
} {
  if (!credential) {
    return {
      clientId: '',
      clientSecret: '',
      companyId: '',
      configured: false,
    };
  }

  const customData = (credential.customHeaders as Record<string, unknown>) || {};

  let clientSecretValue = '';
  if (credential.password) {
    try {
      const decrypted = decrypt(credential.password);
      clientSecretValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      clientSecretValue = '***';
    }
  }

  const companyId = (customData.companyId as string) || '';

  return {
    clientId: credential.clientId || '',
    clientSecret: clientSecretValue,
    companyId,
    configured: !!(credential.clientId && credential.password && companyId),
  };
}

/**
 * GET - Busca configuração atual da Loggi
 */
export const GET = withApiHandler(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  const carrier = await prisma.carrier.findFirst({
    where: { slug: LOGGI_CARRIER_SLUG },
  });

  if (!carrier) {
    return {
      data: {
        configured: false,
        activeEnvironment: 'sandbox' as const,
        production: { configured: false, clientId: '', clientSecret: '', companyId: '' },
        sandbox: { configured: false, clientId: '', clientSecret: '', companyId: '' },
        shippingCommissionPercent: null as number | null,
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
      activeEnvironment: carrier.environment === 'SANDBOX' ? 'sandbox' : 'production',
      production: productionData,
      sandbox: sandboxData,
      shippingCommissionPercent: carrier.shippingCommissionPercent
        ? Number(carrier.shippingCommissionPercent)
        : null,
      carrierIconPath: carrier.logoUrl || null,
      status: carrier.status as string | null,
      lastUpdated: (productionCred?.updatedAt || sandboxCred?.updatedAt || carrier.updatedAt) as Date | null,
    },
  };
});

/**
 * POST - Salva/atualiza configuração da Loggi
 */
export const POST = withApiHandler(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = loggiConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: LoggiConfigInput = parsed.data;

  const hasProdCreds = data.production?.clientId && data.production?.clientSecret
    && data.production?.companyId;
  const hasSandboxCreds = data.sandbox?.clientId && data.sandbox?.clientSecret
    && data.sandbox?.companyId;

  if (!hasProdCreds && !hasSandboxCreds) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Configure ao menos um ambiente com Client ID, Client Secret e Company ID',
      status: 400,
    });
  }

  const baseUrls = {
    sandbox: 'https://stg.api.loggi.com',
    production: 'https://api.loggi.com',
  };

  let carrier = await prisma.carrier.findFirst({
    where: { slug: LOGGI_CARRIER_SLUG },
  });

  await prisma.$transaction(async (tx) => {
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: 'Loggi',
          slug: LOGGI_CARRIER_SLUG,
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: baseUrls[data.activeEnvironment],
          timeout: 30000,
          maxRetries: 3,
          logoUrl: data.carrierIconPath || 'https://loggi.com/wp-content/uploads/2023/01/logo-loggi.png',
          description: 'Integração com APIs da Loggi',
          shippingCommissionPercent: data.shippingCommissionPercent ?? null,
        },
      });
    } else {
      carrier = await tx.carrier.update({
        where: { id: carrier.id },
        data: {
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: baseUrls[data.activeEnvironment],
          logoUrl: data.carrierIconPath ?? carrier.logoUrl,
          shippingCommissionPercent: data.shippingCommissionPercent ?? null,
          updatedAt: new Date(),
        },
      });
    }

    if (data.production) {
      await saveEnvironmentCredentials(tx, carrier.id, 'PRODUCTION', data.production);
    }

    if (data.sandbox) {
      await saveEnvironmentCredentials(tx, carrier.id, 'SANDBOX', data.sandbox);
    }
  });

  invalidateLoggiConfigCache();
  invalidateCarrierCommissionCache(LOGGI_CARRIER_SLUG);

  if (!carrier) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao criar/atualizar carrier',
      status: 500,
    });
  }

  return {
    data: {
      message: 'Configuração salva com sucesso',
      carrier: {
        id: carrier.id,
        slug: carrier.slug,
        status: carrier.status,
        activeEnvironment: data.activeEnvironment,
      },
    },
  };
});

/**
 * Helper para salvar credenciais de um ambiente específico
 */
async function saveEnvironmentCredentials(
  tx: Prisma.TransactionClient,
  carrierId: string,
  environment: 'PRODUCTION' | 'SANDBOX',
  credentials: z.infer<typeof environmentCredentialsSchema>
) {
  if (!credentials.clientId && !credentials.clientSecret && !credentials.companyId) {
    return;
  }

  const existingCred = await tx.carrierCredential.findFirst({
    where: { carrierId, environment, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  // Detectar valores mascarados e recuperar originais
  let finalClientSecret = credentials.clientSecret || '';
  if (credentials.clientSecret === '***' && existingCred?.password) {
    try {
      finalClientSecret = decrypt(existingCred.password);
    } catch {
      finalClientSecret = '';
    }
  }

  // Recuperar companyId existente se não fornecido
  let finalCompanyId = credentials.companyId || '';
  if (!finalCompanyId && existingCred?.customHeaders) {
    const existingCustom = existingCred.customHeaders as Record<string, unknown>;
    finalCompanyId = (existingCustom.companyId as string) || '';
  }

  if (!credentials.clientId || !finalClientSecret || !finalCompanyId) {
    return;
  }

  const customHeaders: Record<string, unknown> = {
    companyId: finalCompanyId,
  };

  // Desativar credenciais antigas
  await tx.carrierCredential.updateMany({
    where: { carrierId, environment, isActive: true },
    data: { isActive: false },
  });

  // Criar nova credencial
  await tx.carrierCredential.create({
    data: {
      carrierId,
      environment,
      authType: 'OAUTH2',
      clientId: credentials.clientId,
      password: encrypt(finalClientSecret),
      customHeaders: customHeaders as Prisma.InputJsonValue,
      isActive: true,
    },
  });
}
