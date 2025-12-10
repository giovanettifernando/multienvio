/**
 * GET/POST /api/admin/payment-gateway/config
 *
 * Gerencia configuração do gateway de pagamento
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
  | { config: Record<string, string> };

/**
 * Tipo de resposta do POST
 */
interface PaymentGatewayPostResponse {
  success: boolean;
  message: string;
}

/**
 * GET - Buscar configuração atual
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

  // Verificar se foi solicitado reveal de campo sensível
  const { searchParams } = new URL(req.url);
  const revealField = searchParams.get('reveal');

  const config: Record<string, string> = {
    environment: gateway.environment,
    publicKey: credential.publicKey || '',
    applicationId: credential.applicationId || '',
  };

  // Revelar campo sensível se solicitado
  if (revealField === 'accessToken' && credential.accessToken) {
    try {
      config.accessToken = decrypt(credential.accessToken);
    } catch {
      config.accessToken = '';
    }
  } else if (revealField === 'webhookSecret' && credential.secretKey) {
    try {
      config.webhookSecret = decrypt(credential.secretKey);
    } catch {
      config.webhookSecret = '';
    }
  }

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
