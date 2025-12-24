/**
 * GET /api/admin/integrations/correios
 * POST /api/admin/integrations/correios
 *
 * Rotas de configuração da integração Correios (Admin)
 * Suporta credenciais separadas para Produção e Homologação
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

import { AdminPermission, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidateCorreiosConfigCache, clearTokenCache } from '@/platform/integrations/correios';
import { invalidateCarrierCommissionCache } from '@/modules/quotes/application/commission';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

const CORREIOS_CARRIER_SLUG = 'correios';

/**
 * Schema de credenciais para um ambiente específico
 */
const environmentCredentialsSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  cartaoPostagem: z.string().optional(),
  contrato: z.string().optional(),
  dr: z.string().optional(),
});

/**
 * Schema de validação para configuração dos Correios
 * Suporta credenciais separadas para cada ambiente
 */
const correiosConfigSchema = z.object({
  // Ambiente ativo para uso
  activeEnvironment: z.enum(['sandbox', 'production']).default('sandbox'),
  // Credenciais de Produção
  production: environmentCredentialsSchema.optional(),
  // Credenciais de Homologação (Sandbox)
  sandbox: environmentCredentialsSchema.optional(),
  // Serviços (compartilhados entre ambientes)
  servicos: z
    .array(
      z.object({
        codigoServico: z.string(),
        coProduto: z.string().optional(),
        nomeExibicao: z.string(),
        habilitado: z.boolean().default(true),
        ordemExibicao: z.number().optional(),
      })
    )
    .optional(),
  // Comissao sobre frete (%)
  shippingCommissionPercent: z
    .number()
    .min(0, 'Comissao nao pode ser negativa')
    .max(100, 'Comissao nao pode exceder 100%')
    .optional()
    .nullable(),
  // Caminho do ícone da transportadora
  carrierIconPath: z.string().optional().nullable(),
});

type CorreiosConfigInput = z.infer<typeof correiosConfigSchema>;

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
  username: string;
  password: string;
  cartaoPostagem: string;
  contrato: string;
  dr: string;
  configured: boolean;
} {
  if (!credential) {
    return {
      username: '',
      password: '',
      cartaoPostagem: '',
      contrato: '',
      dr: '',
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

  return {
    username: credential.username || '',
    password: passwordValue,
    cartaoPostagem: credential.clientId || '',
    contrato: (customData.contrato as string) || '',
    dr: (customData.dr as string) || '',
    configured: !!(credential.username && credential.password && credential.clientId),
  };
}

/**
 * GET - Busca configuração atual dos Correios
 * Query params:
 *   - reveal=true: Retorna valores descriptografados
 */
export const GET = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  // Buscar carrier
  const carrier = await prisma.carrier.findFirst({
    where: { slug: CORREIOS_CARRIER_SLUG },
  });

  if (!carrier) {
    return {
      data: {
        configured: false,
        activeEnvironment: 'sandbox' as const,
        production: { configured: false, username: '', password: '', cartaoPostagem: '', contrato: '', dr: '' },
        sandbox: { configured: false, username: '', password: '', cartaoPostagem: '', contrato: '', dr: '' },
        servicos: [] as unknown[],
        shippingCommissionPercent: null as number | null,
        carrierIconPath: null as string | null,
        status: null as string | null,
        lastUpdated: null as Date | null,
      },
    };
  }

  // Buscar credenciais de cada ambiente
  const [productionCred, sandboxCred] = await Promise.all([
    prisma.carrierCredential.findFirst({
      where: {
        carrierId: carrier.id,
        environment: 'PRODUCTION',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.carrierCredential.findFirst({
      where: {
        carrierId: carrier.id,
        environment: 'SANDBOX',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const productionData = processCredentials(productionCred, shouldReveal);
  const sandboxData = processCredentials(sandboxCred, shouldReveal);

  // Serviços vêm de qualquer credencial (preferência produção)
  const customData = (productionCred?.customHeaders || sandboxCred?.customHeaders || {}) as Record<string, unknown>;

  return {
    data: {
      configured: productionData.configured || sandboxData.configured,
      activeEnvironment: carrier.environment === 'SANDBOX' ? 'sandbox' : 'production',
      production: productionData,
      sandbox: sandboxData,
      servicos: (customData.servicos || []) as unknown[],
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
 * POST - Salva/atualiza configuração dos Correios
 * Suporta credenciais separadas para cada ambiente
 */
export const POST = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  const body = await req.json();
  const parsed = correiosConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: CorreiosConfigInput = parsed.data;

  // Verificar se pelo menos um ambiente tem credenciais completas
  const hasProdCreds = data.production?.username && data.production?.password && data.production?.cartaoPostagem;
  const hasSandboxCreds = data.sandbox?.username && data.sandbox?.password && data.sandbox?.cartaoPostagem;

  if (!hasProdCreds && !hasSandboxCreds) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Configure ao menos um ambiente com usuário, senha e cartão de postagem',
      status: 400,
    });
  }

  // Determinar URLs base por ambiente
  const baseUrls = {
    sandbox: 'https://apihom.correios.com.br',
    production: 'https://api.correios.com.br',
  };

  // Buscar ou criar carrier
  let carrier = await prisma.carrier.findFirst({
    where: { slug: CORREIOS_CARRIER_SLUG },
  });

  await prisma.$transaction(async (tx) => {
    if (!carrier) {
      carrier = await tx.carrier.create({
        data: {
          name: 'Correios',
          slug: CORREIOS_CARRIER_SLUG,
          status: 'ACTIVE',
          environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: baseUrls[data.activeEnvironment],
          timeout: 30000,
          maxRetries: 3,
          logoUrl: data.carrierIconPath || 'https://www.correios.com.br/++resource++correios/img/logo-correios-blue.svg',
          description: 'Integração com APIs dos Correios (CWS)',
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

    // Processar credenciais de PRODUÇÃO
    if (data.production) {
      await saveEnvironmentCredentials(
        tx,
        carrier.id,
        'PRODUCTION',
        data.production,
        data.servicos
      );
    }

    // Processar credenciais de SANDBOX
    if (data.sandbox) {
      await saveEnvironmentCredentials(
        tx,
        carrier.id,
        'SANDBOX',
        data.sandbox,
        data.servicos
      );
    }

  });

  // Invalidar caches
  invalidateCorreiosConfigCache();
  clearTokenCache();
  invalidateCarrierCommissionCache(CORREIOS_CARRIER_SLUG);

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
  credentials: z.infer<typeof environmentCredentialsSchema>,
  servicos?: z.infer<typeof correiosConfigSchema>['servicos']
) {
  // Se não tem dados válidos, não fazer nada
  if (!credentials.username && !credentials.password && !credentials.cartaoPostagem) {
    return;
  }

  // Buscar credencial existente para este ambiente
  const existingCred = await tx.carrierCredential.findFirst({
    where: {
      carrierId,
      environment,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Detectar se senha está mascarada e recuperar valor real
  let finalPassword = credentials.password || '';
  if (credentials.password === '***' && existingCred?.password) {
    try {
      finalPassword = decrypt(existingCred.password);
    } catch {
      finalPassword = '';
    }
  }

  // Se não tem credenciais válidas para este ambiente, pular
  if (!credentials.username || !finalPassword || !credentials.cartaoPostagem) {
    return;
  }

  // Montar customHeaders
  const customHeaders: Record<string, unknown> = {};
  if (credentials.contrato) customHeaders.contrato = credentials.contrato;
  if (credentials.dr) customHeaders.dr = credentials.dr;
  if (servicos && servicos.length > 0) customHeaders.servicos = servicos;

  // Desativar credenciais antigas deste ambiente
  await tx.carrierCredential.updateMany({
    where: {
      carrierId,
      environment,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Criar nova credencial
  await tx.carrierCredential.create({
    data: {
      carrierId,
      environment,
      authType: 'BASIC',
      username: credentials.username,
      password: encrypt(finalPassword),
      clientId: credentials.cartaoPostagem,
      customHeaders: Object.keys(customHeaders).length > 0
        ? (customHeaders as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      isActive: true,
    },
  });
}
