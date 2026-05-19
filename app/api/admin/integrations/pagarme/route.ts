/**
 * GET /api/admin/integrations/pagarme
 * POST /api/admin/integrations/pagarme
 *
 * Rotas de configuração do gateway Pagar.me (Admin)
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

import { AdminPermission, IntegrationStatus } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { invalidatePagarmeConfigCache } from '@/platform/integrations/pagarme';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

/**
 * Tipos de resposta do GET - Union discriminada por 'configured'
 */
type PagarmeConfigData = {
  secretKey: string;
  publicKey: string;
  sandboxMode: boolean;
  status: IntegrationStatus;
  lastUpdated: string;
};

type PagarmeGetResponse =
  | { configured: false; data: null }
  | { configured: true; data: PagarmeConfigData };

/**
 * Tipo de resposta do POST
 */
interface PagarmePostResponse {
  message: string;
  gateway: {
    id: string;
    slug: string;
    status: IntegrationStatus;
  };
}

/**
 * Schema de validação para configuração do Pagar.me
 */
const pagarmeConfigSchema = z.object({
  secretKey: z.string().min(1, 'Secret key é obrigatória'),
  publicKey: z.string().min(1, 'Public key é obrigatória'),
  sandboxMode: z.boolean().default(true),
});

type PagarmeConfigInput = z.infer<typeof pagarmeConfigSchema>;

/**
 * GET - Busca configuração atual do Pagar.me
 */
export const GET = withApiHandler<PagarmeGetResponse>(async ({ req }) => {
  const _session = await requireAdminSession(req, AdminPermission.INTEGRACOES);

  // Buscar gateway e credenciais
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'pagarme' },
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

  // Mascarar secret key (mostrar apenas últimos 4 caracteres)
  let maskedSecretKey = '';
  if (credential.accessToken) {
    try {
      const decrypted = decrypt(credential.accessToken);
      maskedSecretKey = decrypted.length > 4
        ? `***${decrypted.slice(-4)}`
        : '***';
    } catch {
      maskedSecretKey = '***';
    }
  }

  return {
    data: {
      configured: true,
      data: {
        secretKey: maskedSecretKey,
        publicKey: credential.publicKey || '',
        sandboxMode: gateway.environment === 'SANDBOX',
        status: gateway.status,
        lastUpdated: credential.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * POST - Salva/atualiza configuração do Pagar.me
 */
export const POST = withApiHandler<PagarmePostResponse>(async ({ req, logger }) => {
  const _session = await requireAdminSession(req, AdminPermission.INTEGRACOES);

  // Validar payload
  const body = await req.json();
  const parsed = pagarmeConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: PagarmeConfigInput = parsed.data;

  // Buscar ou criar gateway
  let gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'pagarme' },
  });

  await prisma.$transaction(async (tx) => {
    if (!gateway) {
      // Criar novo gateway
      gateway = await tx.paymentGateway.create({
        data: {
          name: 'Pagar.me',
          slug: 'pagarme',
          status: 'ACTIVE',
          environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: data.sandboxMode
            ? 'https://sdx-api.pagar.me/core/v5'
            : 'https://api.pagar.me/core/v5',
          timeout: 30000,
          enabledMethods: ['CREDIT_CARD', 'PIX'],
          description: 'Gateway de pagamento Pagar.me',
        },
      });
    } else {
      // Atualizar gateway existente
      gateway = await tx.paymentGateway.update({
        where: { id: gateway.id },
        data: {
          status: 'ACTIVE',
          environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: data.sandboxMode
            ? 'https://sdx-api.pagar.me/core/v5'
            : 'https://api.pagar.me/core/v5',
          updatedAt: new Date(),
        },
      });
    }

    // Desativar credenciais antigas
    await tx.paymentCredential.updateMany({
      where: {
        gatewayId: gateway!.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Detectar se a secret key está mascarada e recuperar o valor real
    let finalSecretKey = data.secretKey;

    logger.info('pagarme_config_update', {
      secretKeyIsMasked: data.secretKey.startsWith('***'),
    });

    if (data.secretKey.startsWith('***')) {
      const existingCred = await tx.paymentCredential.findFirst({
        where: {
          gatewayId: gateway!.id,
          isActive: false, // Acabamos de desativar
        },
        orderBy: { createdAt: 'desc' },
        select: { accessToken: true },
      });

      if (existingCred?.accessToken) {
        finalSecretKey = decrypt(existingCred.accessToken);
        logger.info('pagarme_config_masked_secret_recovered');
      } else {
        throw new Error('Secret key mascarada detectada mas não há credencial anterior. Por favor, insira a secret key completa.');
      }
    }

    // Criar nova credencial
    await tx.paymentCredential.create({
      data: {
        gatewayId: gateway!.id,
        environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
        authType: 'BEARER',
        publicKey: data.publicKey,
        accessToken: encrypt(finalSecretKey),
        isActive: true,
      },
    });
  });

  // Invalidar cache de configuração
  invalidatePagarmeConfigCache();

  // Gateway não pode ser null aqui pois foi criado/atualizado na transaction
  if (!gateway) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao criar/atualizar gateway',
      status: 500,
    });
  }

  logger.info('pagarme_config_updated', { sandboxMode: data.sandboxMode });

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
