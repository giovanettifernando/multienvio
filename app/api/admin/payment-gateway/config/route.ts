/**
 * GET/POST /api/admin/payment-gateway/config
 *
 * Gerencia configuração do gateway de pagamento
 *
 * SECURITY: Credenciais sensíveis (accessToken, webhookSecret) não são expostas.
 * Se precisar atualizar, basta cadastrar novos valores.
 */

import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/integrations/shared/encryption.service';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';

/**
 * Tipos de resposta do GET - Union discriminada
 */
type PaymentGatewayGetResponse =
  | { config: null }
  | { config: Record<string, string | boolean> };

/**
 * Tipo de resposta do POST
 */
interface PaymentGatewayPostResponse {
  success: boolean;
  message: string;
}

/**
 * GET - Buscar configuração atual
 * Query params:
 *   - reveal=true: Retorna accessToken e webhookSecret descriptografados
 */
export const GET = withApiHandler<PaymentGatewayGetResponse>(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  // Buscar gateway e credenciais
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
    include: {
      credentials: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!gateway || gateway.credentials.length === 0) {
    return { data: { config: null } };
  }

  const credential = gateway.credentials[0];

  // Descriptografar valores se reveal=true
  let accessTokenValue = '';
  if (credential.accessToken) {
    try {
      const decrypted = decrypt(credential.accessToken);
      accessTokenValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***configurado***' : '');
    } catch {
      accessTokenValue = shouldReveal ? '' : '***';
    }
  }

  let webhookSecretValue = '';
  if (credential.secretKey) {
    try {
      const decrypted = decrypt(credential.secretKey);
      webhookSecretValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***configurado***' : '');
    } catch {
      webhookSecretValue = shouldReveal ? '' : '***';
    }
  }

  const config: Record<string, string | boolean> = {
    environment: gateway.environment,
    publicKey: credential.publicKey || '',
    applicationId: credential.applicationId || '',
    accessToken: accessTokenValue,
    webhookSecret: webhookSecretValue,
    hasAccessToken: Boolean(credential.accessToken),
    hasWebhookSecret: Boolean(credential.secretKey),
  };

  return { data: { config } };
});

const PaymentGatewayConfigSchema = z.object({
  environment: z.enum(['PRODUCTION', 'SANDBOX']),
  publicKey: z.string().min(1),
  accessToken: z.string().optional(),
  applicationId: z.string().optional(),
  webhookSecret: z.string().optional(),
});

/**
 * POST - Salvar configuração
 */
export const POST = withApiHandler<PaymentGatewayPostResponse>(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const body = await req.json();

  const parsed = PaymentGatewayConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { environment, publicKey, accessToken, applicationId, webhookSecret } = parsed.data;

  // Buscar ou criar gateway
  let gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
  });

  if (!gateway) {
    gateway = await prisma.paymentGateway.create({
      data: {
        slug: 'mercadopago',
        name: 'Mercado Pago',
        environment,
        status: 'ACTIVE',
      },
    });
  } else {
    // Atualizar environment
    gateway = await prisma.paymentGateway.update({
      where: { id: gateway.id },
      data: { environment },
    });
  }

  // Buscar credencial ativa
  let credential = await prisma.paymentCredential.findFirst({
    where: {
      gatewayId: gateway.id,
      isActive: true,
    },
  });

  const credentialData: {
    publicKey: string;
    accessToken?: string;
    applicationId?: string;
    secretKey?: string;
  } = {
    publicKey,
  };

  // Salvar applicationId se fornecido
  if (applicationId) {
    credentialData.applicationId = applicationId;
  }

  // Criptografar accessToken se fornecido
  if (accessToken) {
    credentialData.accessToken = encrypt(accessToken);
  }

  // Criptografar webhookSecret se fornecido
  if (webhookSecret) {
    credentialData.secretKey = encrypt(webhookSecret);
  }

  if (credential) {
    // Atualizar credencial existente
    credential = await prisma.paymentCredential.update({
      where: { id: credential.id },
      data: credentialData,
    });
  } else {
    // Criar nova credencial
    credential = await prisma.paymentCredential.create({
      data: {
        gatewayId: gateway.id,
        environment,
        authType: 'API_KEY',
        ...credentialData,
        isActive: true,
      },
    });
  }

  return {
    data: {
      success: true,
      message: 'Configuração salva com sucesso',
    },
  };
});
