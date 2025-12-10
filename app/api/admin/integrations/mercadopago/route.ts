/**
 * GET /api/admin/integrations/mercadopago
 * POST /api/admin/integrations/mercadopago
 *
 * Rotas de configuração do gateway Mercado Pago (Admin)
 */

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission, IntegrationStatus } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/integrations/shared/encryption.service';
import { invalidateConfigCache } from '@/lib/mercadopago';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

/**
 * Tipos de resposta do GET - Union discriminada por 'configured'
 */
type MercadoPagoConfigData = {
  publicKey: string;
  accessToken: string;
  webhookSecret: string;
  webhookUrl: string;
  sandboxMode: boolean;
  status: IntegrationStatus;
  lastUpdated: string;
};

type MercadoPagoGetResponse =
  | { configured: false; data: null }
  | { configured: true; data: MercadoPagoConfigData };

/**
 * Tipo de resposta do POST
 */
interface MercadoPagoPostResponse {
  message: string;
  gateway: {
    id: string;
    slug: string;
    status: IntegrationStatus;
  };
}

/**
 * Schema de validação para configuração do Mercado Pago
 */
const mercadoPagoConfigSchema = z.object({
  publicKey: z.string().min(1, 'Public Key é obrigatória'),
  accessToken: z.string().min(1, 'Access Token é obrigatório'),
  webhookSecret: z.string().optional(),
  webhookUrl: z.string().url('URL do webhook inválida').optional(),
  sandboxMode: z.boolean().default(true),
});

type MercadoPagoConfigInput = z.infer<typeof mercadoPagoConfigSchema>;

/**
 * GET - Busca configuração atual do Mercado Pago
 */
export const GET = withApiHandler<MercadoPagoGetResponse>(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // Buscar gateway e credenciais
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
    include: {
      credentials: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      endpoints: {
        where: { operation: 'webhook' },
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
  const webhookEndpoint = gateway.endpoints[0];

  // Mascarar access token (mostrar apenas últimos 4 caracteres)
  let maskedAccessToken = '';
  if (credential.accessToken) {
    try {
      const decrypted = decrypt(credential.accessToken);
      maskedAccessToken = decrypted.length > 4
        ? `***${decrypted.slice(-4)}`
        : '***';
    } catch {
      maskedAccessToken = '***';
    }
  }

  // Mascarar webhook secret
  let maskedWebhookSecret = '';
  if (credential.secretKey) {
    try {
      const decrypted = decrypt(credential.secretKey);
      maskedWebhookSecret = decrypted.length > 4
        ? `***${decrypted.slice(-4)}`
        : '***';
    } catch {
      maskedWebhookSecret = '***';
    }
  }

  return {
    data: {
      configured: true,
      data: {
        publicKey: credential.publicKey || '',
        accessToken: maskedAccessToken,
        webhookSecret: maskedWebhookSecret,
        webhookUrl: webhookEndpoint?.path || '',
        sandboxMode: gateway.environment === 'SANDBOX',
        status: gateway.status,
        lastUpdated: credential.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * POST - Salva/atualiza configuração do Mercado Pago
 */
export const POST = withApiHandler<MercadoPagoPostResponse>(async ({ req, logger }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // Validar payload
  const body = await req.json();
  const parsed = mercadoPagoConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: MercadoPagoConfigInput = parsed.data;

  // Buscar ou criar gateway
  let gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
  });

  await prisma.$transaction(async (tx) => {
    if (!gateway) {
      // Criar novo gateway
      gateway = await tx.paymentGateway.create({
        data: {
          name: 'Mercado Pago',
          slug: 'mercadopago',
          status: 'ACTIVE',
          environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
          baseUrl: data.sandboxMode
            ? 'https://api.mercadopago.com'
            : 'https://api.mercadopago.com',
          timeout: 30000,
          enabledMethods: ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO'],
          logoUrl: 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.1/mercadopago/logo__large@2x.png',
          description: 'Gateway de pagamento Mercado Pago',
        },
      });
    } else {
      // Atualizar gateway existente
      gateway = await tx.paymentGateway.update({
        where: { id: gateway.id },
        data: {
          status: 'ACTIVE',
          environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
          updatedAt: new Date(),
        },
      });
    }

    // Desativar credenciais antigas

    const _oldCredentials = await tx.paymentCredential.updateMany({
      where: {
        gatewayId: gateway.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Detectar se tokens estão mascarados e recuperar valores reais
    let finalAccessToken = data.accessToken;
    let finalWebhookSecret = data.webhookSecret;

    logger.info('mercadopago_config_update', {
      accessTokenIsMasked: data.accessToken.startsWith('***'),
      webhookSecretIsMasked: data.webhookSecret?.startsWith('***'),
    });

    // Se o access token está mascarado (começa com ***), recuperar o token real
    if (data.accessToken.startsWith('***')) {
      const existingCred = await tx.paymentCredential.findFirst({
        where: {
          gatewayId: gateway.id,
          isActive: false, // Acabamos de desativar
        },
        orderBy: { createdAt: 'desc' },
        select: { accessToken: true },
      });

      if (existingCred?.accessToken) {
        // Usar o token criptografado existente (já está criptografado, não criptografar novamente)
        finalAccessToken = decrypt(existingCred.accessToken); // Descriptografar para re-criptografar depois
        logger.info('mercadopago_config_masked_token_recovered');
      } else {
        throw new Error('Token mascarado detectado mas não há credencial anterior. Por favor, insira o Access Token completo.');
      }
    }

    // Se o webhook secret está mascarado (começa com ***), recuperar o secret real
    if (finalWebhookSecret && finalWebhookSecret.startsWith('***')) {
      const existingCred = await tx.paymentCredential.findFirst({
        where: {
          gatewayId: gateway.id,
          isActive: false,
        },
        orderBy: { createdAt: 'desc' },
        select: { secretKey: true },
      });

      if (existingCred?.secretKey) {
        finalWebhookSecret = decrypt(existingCred.secretKey); // Descriptografar para re-criptografar depois
      } else {
        // Webhook secret é opcional, então não lançar erro
        finalWebhookSecret = undefined;
      }
    }

    // Criar nova credencial
    await tx.paymentCredential.create({
      data: {
        gatewayId: gateway.id,
        environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
        authType: 'BEARER',
        publicKey: data.publicKey,
        accessToken: encrypt(finalAccessToken), // Criptografar
        secretKey: finalWebhookSecret ? encrypt(finalWebhookSecret) : null,
        isActive: true,
      },
    });

    // Criar/atualizar endpoint de webhook se fornecido
    if (data.webhookUrl) {
      await tx.paymentEndpoint.upsert({
        where: {
          gatewayId_operation: {
            gatewayId: gateway.id,
            operation: 'webhook',
          },
        },
        create: {
          gatewayId: gateway.id,
          operation: 'webhook',
          method: 'POST',
          path: data.webhookUrl,
          timeout: 30000,
          retryable: true,
        },
        update: {
          path: data.webhookUrl,
          updatedAt: new Date(),
        },
      });
    }
  });

  // Invalidar cache de configuração
  invalidateConfigCache();

  // Gateway não pode ser null aqui pois foi criado/atualizado na transaction
  if (!gateway) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao criar/atualizar gateway',
      status: 500,
    });
  }

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
