import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { generateToken, hashToken } from '@/modules/auth/application/tokens';
import { sendVerificationEmail } from '@/platform/email/mailer';
import { enforceRateLimitByIP, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';

const ResendSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ResendVerificationResponse =
  | {
      success: true;
      message: string;
      code: null;
      emailSent: null;
    }
  | {
      success: true;
      message: string;
      code: 'ALREADY_VERIFIED';
      emailSent: null;
    }
  | {
      success: true;
      message: string;
      code: null;
      emailSent: boolean;
    };

export const POST = withApiHandler<ResendVerificationResponse>(async (context) => {
  const { req, logger } = context;

  // Rate limiting by IP - 3 attempts per 10 minutes (same as password reset - sensitive operation)
  await enforceRateLimitByIP(req as NextRequest, 'resend_verification', RATE_LIMITS.PASSWORD_RESET);

  try {
    const body = await req.json();
    const { email } = ResendSchema.parse(body);

    logger.info('resend_verification_request');

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return {
        data: {
          success: true,
          message: 'Se o email estiver cadastrado, você receberá um novo link de verificação.',
          code: null,
          emailSent: null,
        },
      };
    }

    // Check if already verified
    if (user.emailVerified) {
      logger.info('resend_verification_already_verified');
      return {
        data: {
          success: true,
          message: 'Este email já foi verificado. Você pode fazer login.',
          code: 'ALREADY_VERIFIED',
          emailSent: null,
        },
      };
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const hashedVerificationToken = hashToken(verificationToken);

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedVerificationToken,
      },
    });

    logger.info('resend_verification_token_generated', { userId: user.id });

    // Send verification email
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(user.email, user.name, verificationToken);

      if (emailSent) {
        logger.info('resend_verification_email_sent', { userId: user.id });
      } else {
        logger.error('resend_verification_email_failed', { userId: user.id });
      }
    } catch (error) {
      logger.error('resend_verification_email_error', { userId: user.id, err: error });
    }

    return {
      data: {
        success: true,
        message: emailSent
          ? 'Email de verificação reenviado com sucesso! Verifique sua caixa de entrada.'
          : 'Não foi possível enviar o email. Tente novamente em alguns minutos.',
        code: null,
        emailSent,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Email inválido',
        status: 400,
        details: { errors: error.issues },
      });
    }

    logger.error('resend_verification_error', { err: error });
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao processar solicitação',
      status: 500,
    });
  }
});
