/**
 * GET /api/admin/integrations/asaas
 * POST /api/admin/integrations/asaas
 *
 * Rotas de configuração do gateway Asaas (Admin)
 *
 * Diferente do Pagar.me, o Asaas usa uma única chave de API (sem par
 * público/secreto) e um token de webhook definido por nós, cadastrado
 * também no painel do Asaas para validar a assinatura dos eventos.
 *
 * SECURITY: a chave de API e o token de webhook NUNCA são devolvidos ao
 * cliente — nem mascarados a partir do valor real. O GET só informa se está
 * configurado e, no máximo, um placeholder fixo derivado do ambiente
 * (sandbox/produção), nunca derivado da credencial descriptografada.
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

import { AdminPermission, IntegrationStatus } from '@prisma/client';
import { encrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidateAsaasConfigCache } from '@/platform/integrations/asaas';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

const ASAAS_SLUG = 'asaas';
const SANDBOX_BASE_URL = 'https://api-sandbox.asaas.com';
const PRODUCTION_BASE_URL = 'https://api.asaas.com';

/**
 * Tipos de resposta do GET - Union discriminada por 'configured'
 */
type AsaasConfigData = {
  /** Placeholder fixo por ambiente — nunca deriva da chave real. */
  apiKeyPreview: string;
  webhookTokenConfigured: boolean;
  sandboxMode: boolean;
  status: IntegrationStatus;
  lastUpdated: string;
};

type AsaasGetResponse =
  | { configured: false; data: null }
  | { configured: true; data: AsaasConfigData };

/**
 * Tipo de resposta do POST
 */
interface AsaasPostResponse {
  message: string;
  gateway: {
    id: string;
    slug: string;
    status: IntegrationStatus;
  };
}

/**
 * Schema de validação para configuração do Asaas.
 *
 * O token de webhook é opcional (o Asaas segue funcionando sem ele, mas a
 * validação de webhook falha por omissão — comportamento proposital), porém
 * quando informado precisa ter entre 32 e 255 caracteres e nenhum espaço.
 */
const webhookTokenSchema = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : val),
  z
    .string()
    .min(32, 'Token de webhook deve ter entre 32 e 255 caracteres')
    .max(255, 'Token de webhook deve ter entre 32 e 255 caracteres')
    .refine((v) => !/\s/.test(v), 'Token de webhook não pode conter espaços')
    .optional(),
);

const asaasConfigSchema = z.object({
  apiKey: z.string().min(1, 'Chave de API é obrigatória'),
  webhookToken: webhookTokenSchema,
  sandboxMode: z.boolean().default(true),
});

type AsaasConfigInput = z.infer<typeof asaasConfigSchema>;

/**
 * GET - Busca configuração atual do Asaas
 */
export const GET = withApiHandler<AsaasGetResponse>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: ASAAS_SLUG },
    include: {
      credentials: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!gateway || gateway.credentials.length === 0) {
    return {
      data: {
        configured: false,
        data: null,
      },
    };
  }

  const credential = gateway.credentials[0];
  const sandboxMode = gateway.environment === 'SANDBOX';

  return {
    data: {
      configured: true,
      data: {
        // Placeholder fixo — não deriva de credential.accessToken em nenhum momento.
        apiKeyPreview: sandboxMode ? '$aact_hmlg_xxxx***' : '$aact_prod_xxxx***',
        webhookTokenConfigured: Boolean(credential.clientSecret),
        sandboxMode,
        status: gateway.status,
        lastUpdated: credential.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * POST - Salva/atualiza configuração do Asaas
 */
export const POST = withApiHandler<AsaasPostResponse>(async ({ req, logger }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  const body = await req.json();
  const parsed = asaasConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: AsaasConfigInput = parsed.data;
  const baseUrl = data.sandboxMode ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;

  // Atomicidade obrigatória: se a criação da credencial nova falhar depois de
  // desativar a antiga, o gateway ficaria sem nenhuma credencial ativa
  // (pagamento fora do ar). Gateway + desativação + criação na mesma
  // transação — ou tudo acontece, ou nada acontece. Mesmo desenho de
  // scripts/seed-asaas-gateway.ts.
  const gateway = await prisma.$transaction(async (tx) => {
    const existingGateway = await tx.paymentGateway.findFirst({
      where: { slug: ASAAS_SLUG },
    });

    const savedGateway = existingGateway
      ? await tx.paymentGateway.update({
          where: { id: existingGateway.id },
          data: {
            status: 'ACTIVE',
            environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
            baseUrl,
          },
        })
      : await tx.paymentGateway.create({
          data: {
            name: 'Asaas',
            slug: ASAAS_SLUG,
            status: 'ACTIVE',
            environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
            baseUrl,
            timeout: 30000,
            enabledMethods: ['PIX', 'CREDIT_CARD', 'BOLETO'],
            description: 'Gateway de pagamento Asaas — PIX, cartão e boleto',
          },
        });

    await tx.paymentCredential.updateMany({
      where: { gatewayId: savedGateway.id, isActive: true },
      data: { isActive: false },
    });

    await tx.paymentCredential.create({
      data: {
        gatewayId: savedGateway.id,
        environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
        authType: 'API_KEY',
        accessToken: encrypt(data.apiKey),
        clientSecret: data.webhookToken ? encrypt(data.webhookToken) : null,
        isActive: true,
      },
    });

    return savedGateway;
  });

  // Cache de 5min em getAsaasConfig() — sem invalidar, a credencial nova só
  // passa a valer depois desse prazo.
  invalidateAsaasConfigCache();

  logger.info('asaas_config_updated', {
    sandboxMode: data.sandboxMode,
    webhookTokenConfigured: Boolean(data.webhookToken),
  });

  return {
    data: {
      message: 'Configuração salva com sucesso',
      gateway: {
        id: gateway.id,
        slug: gateway.slug,
        status: gateway.status,
      },
    },
  };
});
