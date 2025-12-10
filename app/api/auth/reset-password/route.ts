import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { ResetPasswordSchema } from '@/lib/validation/auth';
import prisma from '@/lib/db';
import crypto from 'crypto';

interface ResetPasswordResponse {
  message: string;
  success: boolean;
}

export const POST = withApiHandler<ResetPasswordResponse>(async (context) => {
  const { req, logger } = context;

  try {
    const payload = await req.json();
    const data = ResetPasswordSchema.parse(payload);

    logger.info('reset_password_attempt');

    // Hash the token to compare with database
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

    // Find reset token record
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            tokenVersion: true,
          },
        },
      },
    });

    if (!resetToken) {
      logger.warn('reset_password_invalid_token');
      throw new ApiError({
        code: 'INVALID_TOKEN',
        message: 'Token de redefinição inválido ou expirado',
        status: 400,
      });
    }

    // Check if token has already been used
    if (resetToken.usedAt) {
      logger.warn('reset_password_token_used');
      throw new ApiError({
        code: 'TOKEN_USED',
        message: 'Este link já foi utilizado. Solicite um novo link.',
        status: 400,
      });
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      logger.warn('reset_password_token_expired');
      throw new ApiError({
        code: 'TOKEN_EXPIRED',
        message: 'Token de redefinição expirado. Solicite um novo link.',
        status: 400,
      });
    }

    // Hash new password with bcrypt (12 salt rounds for consistency with password change)
    const passwordHash = await bcrypt.hash(data.password, 12);
    logger.debug('reset_password_hash_generated');

    const now = new Date();

    // Update user's password, increment tokenVersion, and mark token as used
    await prisma.$transaction([
      // Update user password and invalidate all sessions
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordUpdatedAt: now,
          tokenVersion: resetToken.user.tokenVersion + 1, // Invalidate all existing sessions
          updatedAt: now,
        },
      }),
      // Mark token as used
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          usedAt: now,
        },
      }),
    ]);

    logger.info('reset_password_success', { userId: resetToken.userId });

    return {
      data: {
        message: 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.',
        success: true,
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof ZodError) {
      logger.debug('reset_password_validation_error', { issues: error.issues });
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        status: 422,
        details: {
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    logger.error('reset_password_error', { err: error });
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao redefinir senha',
      status: 500,
    });
  }
});
