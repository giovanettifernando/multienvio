import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { hashToken } from '@/lib/auth/tokens';

type VerifyEmailResponse =
  | {
      success: true;
      message: string;
      code: 'ALREADY_VERIFIED';
      email: string;
    }
  | {
      success: true;
      message: string;
      code: 'SUCCESS';
      email: string;
    };

export const GET = withApiHandler<VerifyEmailResponse>(async (context) => {
  const { req, logger } = context;

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    throw new ApiError({
      code: 'MISSING_TOKEN',
      message: 'Token de verificação não fornecido',
      status: 400,
    });
  }

  logger.info('verify_email_attempt');

  // Hash the token to compare with database
  const hashedToken = hashToken(token);

  // Check if user with this token exists and is already verified
  const existingUser = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
    },
  });

  if (existingUser && existingUser.emailVerified) {
    logger.info('verify_email_already_verified');
    return {
      data: {
        success: true,
        message: 'Este email já foi verificado anteriormente. Você pode fazer login.',
        code: 'ALREADY_VERIFIED',
        email: existingUser.email,
      },
    };
  }

  // Find user with matching verification token and not verified
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
      emailVerified: false,
    },
  });

  if (!user) {
    logger.warn('verify_email_invalid_token');
    throw new ApiError({
      code: 'INVALID_TOKEN',
      message: 'Token de verificação inválido ou expirado. Solicite um novo email de verificação.',
      status: 400,
    });
  }

  // Update user to mark email as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null, // Clear the token
      status: 'active', // Activate the account
    },
  });

  logger.info('verify_email_success', { userId: user.id });

  return {
    data: {
      success: true,
      message: 'Email verificado com sucesso! Você já pode fazer login.',
      code: 'SUCCESS',
      email: user.email,
    },
  };
});
