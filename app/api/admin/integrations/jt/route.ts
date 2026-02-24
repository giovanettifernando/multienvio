/**
 * GET /api/admin/integrations/jt
 * POST /api/admin/integrations/jt
 *
 * Rotas de configuração da integração J&T Express (Admin)
 * Suporta credenciais separadas para Produção e Homologação
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidateJTConfigCache } from '@/platform/integrations/jt';
import { invalidateCarrierCommissionCache } from '@/modules/quotes/application/commission';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

const JT_CARRIER_SLUG = 'jt';

/**
 * Schema de credenciais para um ambiente específico
 */
const environmentCredentialsSchema = z.object({
  customerCode: z.string().optional(),
  password: z.string().optional(),
  apiAccount: z.string().optional(),
  privateKey: z.string().optional(),
});

/**
 * Schema de validação para configuração da J&T
 */
const jtConfigSchema = z.object({
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

type JTConfigInput = z.infer<typeof jtConfigSchema>;

/**
 * Helper para processar credenciais de um ambiente
 */
function processCredentials(
  credential: {
    username: string | null;
    password: string | null;
    clientId: string | null;
    customHeaders: unknown;
  } | null,
  shouldReveal: boolean
): {
  customerCode: string;
  password: string;
  apiAccount: string;
  privateKey: string;
  configured: boolean;
} {
  if (!credential) {
    return {
      customerCode: '',
      password: '',
      apiAccount: '',
      privateKey: '',
      configured: false,
    };
  }

  const customData = (credential.customHeaders as Record<string, unknown>) || {};

  let passwordValue = '';
  if (credential.password) {
    try {
      const decrypted = decrypt(credential.password);
      passwordValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      passwordValue = '***';
    }
  }

  let privateKeyValue = '';
  if (customData.privateKey) {
    try {
      const decrypted = decrypt(customData.privateKey as string);
      privateKeyValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      privateKeyValue = '***';
    }
  }

  return {
    customerCode: credential.username || '',
    password: passwordValue,
    apiAccount: credential.clientId || '',
    privateKey: privateKeyValue,
    configured: !!(credential.username && credential.password && credential.clientId && customData.privateKey),
  };
}

/**
 * GET - Busca configuração atual da J&T
 */
export const GET = withApiHandler(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  const carrier = await prisma.carrier.findFirst({
    where: { slug: JT_CARRIER_SLUG },
  });

  if (!carrier) {
    return {
      data: {
        configured: false,
        activeEnvironment: 'sandbox' as const,
        production: { configured: false, customerCode: '', password: '', apiAccount: '', privateKey: '' },
        sandbox: { configured: false, customerCode: '', password: '', apiAccount: '', privateKey: '' },
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
 * POST - Salva/atualiza configuração da J&T
 */
export const POST = withApiHandler(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = jtConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: JTConfigInput = parsed.data;

  const hasProdCreds = data.production?.customerCode && data.production?.password
    && data.production?.apiAccount && data.production?.privateKey;
  const hasSandboxCreds = data.sandbox?.customerCode && data.sandbox?.password
    && data.sandbox?.apiAccount && data.sandbox?.privateKey;

  if (!hasProdCreds && !hasSandboxCreds) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Configure ao menos um ambiente com Customer Code, Senha, API Account e Private Key',
      status: 400,
    });
  }

  const baseUrls = {
    sandbox: 'https://demoopenapi.jtjms-br.com',
    production: 'https://openapi.jtjms-br.com',
  };

  let carrier = await prisma.carrier.findFirst({
    where: { slug: JT_CARRIER_SLUG },
  });

  await prisma.$transaction(async (tx) => {
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: 'J&T Express',
          slug: JT_CARRIER_SLUG,
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: baseUrls[data.activeEnvironment],
          timeout: 30000,
          maxRetries: 3,
          logoUrl: data.carrierIconPath || 'https://www.jtexpress.com.br/newassets/images/logo.png',
          description: 'Integração com APIs da J&T Express Brasil',
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

  invalidateJTConfigCache();
  invalidateCarrierCommissionCache(JT_CARRIER_SLUG);

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
  if (!credentials.customerCode && !credentials.password && !credentials.apiAccount && !credentials.privateKey) {
    return;
  }

  const existingCred = await tx.carrierCredential.findFirst({
    where: { carrierId, environment, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  // Detectar valores mascarados e recuperar originais
  let finalPassword = credentials.password || '';
  if (credentials.password === '***' && existingCred?.password) {
    try {
      finalPassword = decrypt(existingCred.password);
    } catch {
      finalPassword = '';
    }
  }

  let finalPrivateKey = credentials.privateKey || '';
  if (credentials.privateKey === '***' && existingCred?.customHeaders) {
    const existingCustom = existingCred.customHeaders as Record<string, unknown>;
    if (existingCustom.privateKey) {
      try {
        finalPrivateKey = decrypt(existingCustom.privateKey as string);
      } catch {
        finalPrivateKey = '';
      }
    }
  }

  if (!credentials.customerCode || !finalPassword || !credentials.apiAccount || !finalPrivateKey) {
    return;
  }

  const customHeaders: Record<string, unknown> = {
    privateKey: encrypt(finalPrivateKey),
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
      authType: 'SIGNED_HEADER',
      username: credentials.customerCode,
      password: encrypt(finalPassword),
      clientId: credentials.apiAccount,
      customHeaders: customHeaders as Prisma.InputJsonValue,
      isActive: true,
    },
  });
}
