/**
 * GET /api/admin/config/google-oauth
 * POST /api/admin/config/google-oauth
 *
 * Rotas de configuração das credenciais Google OAuth (Admin)
 */

import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

/**
 * Schema de validação para configuração Google OAuth
 */
const googleOAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID é obrigatório'),
  clientSecret: z.string().min(1, 'Client Secret é obrigatório'),
  isActive: z.boolean().default(true),
});

/**
 * GET - Retorna a configuração atual
 * Query params:
 *   - reveal=true: Retorna clientSecret descriptografado
 */
export const GET = withApiHandler(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  // Buscar configuração ativa
  const config = await prisma.googleOAuthConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!config) {
    return {
      data: {
        configured: false,
        clientId: '',
        clientSecret: '',
        isActive: false,
        updatedAt: null as Date | null,
      },
    };
  }

  // Descriptografar clientSecret
  let clientSecretValue = '';
  try {
    const decrypted = decrypt(config.clientSecret);
    clientSecretValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***configurado***' : '');
  } catch {
    clientSecretValue = shouldReveal ? '' : '***';
  }

  return {
    data: {
      configured: true,
      clientId: config.clientId,
      clientSecret: clientSecretValue,
      isActive: config.isActive,
      updatedAt: config.updatedAt as Date | null,
    },
  };
});

/**
 * POST - Salva a configuração
 */
export const POST = withApiHandler(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const body = await req.json();
  const parsed = googleOAuthConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { clientId, clientSecret, isActive } = parsed.data;

  // Criptografar clientSecret
  const encryptedSecret = encrypt(clientSecret);

  // Desativar configurações anteriores
  await prisma.googleOAuthConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  // Criar nova configuração
  const config = await prisma.googleOAuthConfig.create({
    data: {
      clientId,
      clientSecret: encryptedSecret,
      isActive,
    },
  });

  // Invalidar cache do módulo google-oauth
  try {
    const { invalidateGoogleOAuthCache } = await import('@/modules/auth/application/google-oauth');
    invalidateGoogleOAuthCache();
  } catch {
    // Cache não implementado ainda
  }

  return {
    data: {
      success: true,
      message: 'Configuração salva com sucesso',
      id: config.id,
    },
  };
});
