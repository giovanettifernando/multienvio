import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { ForgotPasswordSchema } from '@/lib/validation/auth';
import prisma from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email/mailer';
import crypto from 'crypto';
import { enforceRateLimitByIPStrict, RATE_LIMITS } from '@/lib/rate-limit-redis';

interface ForgotPasswordResponse {
  message: string;
}

export const POST = withApiHandler<ForgotPasswordResponse>(async (context) => {
  const { req, logger } = context;

  // Rate limiting by IP - STRICT (fail-close) - 3 attempts per 10 minutes
  // Se Redis indisponível, retorna 503 ao invés de permitir acesso
  await enforceRateLimitByIPStrict(req as NextRequest, 'client_forgot_password', RATE_LIMITS.PASSWORD_RESET);

  try {
    const payload = await req.json();
    const data = ForgotPasswordSchema.parse(payload);

    logger.info('forgot_password_request');

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      logger.debug('forgot_password_user_not_found');
      return {
        data: {
          message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
        },
      };
    }

    // Generate random token (32 bytes = 256 bits)
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token with SHA-256 for storage
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Expiry: 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token in password_reset_tokens table
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    logger.info('forgot_password_token_created', { userId: user.id });

    // Build reset URL - usar EMAIL_PUBLIC_URL para garantir URL pública em servidores
    const baseUrl = process.env.EMAIL_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl
    );

    if (!emailSent) {
      logger.error('forgot_password_email_failed', { userId: user.id });
    } else {
      logger.info('forgot_password_email_sent', { userId: user.id });
    }

    return {
      data: {
        message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
      },
    };
  } catch (error) {
    if (error instanceof ZodError) {
      logger.debug('forgot_password_validation_error', { issues: error.issues });
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

    logger.error('forgot_password_error', { err: error });
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao processar solicitação',
      status: 500,
    });
  }
});
