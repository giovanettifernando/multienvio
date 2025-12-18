/**
 * POST /api/coletor/reset-password
 *
 * Processa a redefinição de senha do coletor usando o token JWT
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { jwtVerify } from 'jose';
import { prisma } from '@/platform/db/db';
import bcrypt from 'bcrypt';
import { CollectorResetPasswordSchema } from '@/shared/validation/auth';
import { logger } from '@/platform/logging/logger';


// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

// JWT Secret - Nunca usar fallbacks em produção
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

interface TokenPayload {
  collectorId: string;
  email: string;
  type: string;
}

interface CollectorResetPasswordResponse {
  message: string;
}

/**
 * POST /api/coletor/reset-password
 * Redefine a senha do coletor
 */
export const POST = withApiHandler<CollectorResetPasswordResponse>(async (context) => {
  const body = await context.req.json();

  // Validação com Zod
  const parsed = CollectorResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    logger.debug({ event: 'collector_reset_password_validation_error', errors: parsed.error.flatten() }, 'Validation failed');
    throw ApiError.validation(parsed.error.issues[0]?.message || 'Dados inválidos', parsed.error.flatten());
  }

  const { token, newPassword } = parsed.data;

  // Verificar e decodificar token JWT
  let payload: TokenPayload;
  try {
    const { payload: jwtPayload } = await jwtVerify(token, JWT_SECRET);
    payload = jwtPayload as unknown as TokenPayload;

    if (payload.type !== 'password-reset') {
      throw ApiError.badRequest('Token inválido');
    }
  } catch (error) {
    logger.warn({ event: 'collector_reset_password_invalid_token', err: error }, 'Invalid or expired token');
    throw ApiError.badRequest('Token inválido ou expirado. Solicite um novo link de redefinição.');
  }

  // Buscar coletor
  const collector = await prisma.collector.findUnique({
    where: { id: payload.collectorId },
    include: { credential: true },
  });

  if (!collector) {
    throw ApiError.notFound('Coletor não encontrado');
  }

  if (collector.pfEmail !== payload.email) {
    throw ApiError.badRequest('Token inválido para este coletor');
  }

  // Gerar hash da nova senha
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Atualizar ou criar credential
  if (collector.credential) {
    await prisma.collectorCredential.update({
      where: { id: collector.credential.id },
      data: { passwordHash },
    });
  } else {
    await prisma.collectorCredential.create({
      data: {
        collectorId: collector.id,
        passwordHash,
      },
    });
  }

  logger.info({ event: 'collector_reset_password_success', collectorId: collector.id }, 'Password reset successful');

  return {
    data: {
      message: 'Senha redefinida com sucesso!',
    },
  };
});
