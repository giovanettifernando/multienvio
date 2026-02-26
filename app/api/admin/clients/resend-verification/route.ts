/**
 * POST /api/admin/clients/resend-verification
 *
 * Reenvia email de verificacao para usuario com email nao confirmado
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { generateToken, hashToken } from '@/modules/auth/application/tokens';
import { sendVerificationEmail } from '@/platform/email/mailer';
import { z } from 'zod';

interface ResendVerificationResponse {
  ok: boolean;
  message: string;
  emailSent: boolean;
}

const ResendVerificationSchema = z.object({
  id: z.string().min(1, 'ID do usuario e obrigatorio'),
});

export const POST = withApiHandler<ResendVerificationResponse>(async ({ req, logger }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const body = await req.json();

  const parsed = ResendVerificationSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados invalidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { id } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, emailVerified: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuario nao encontrado',
      status: 404,
    });
  }

  if (user.emailVerified) {
    throw new ApiError({
      code: 'ALREADY_VERIFIED',
      message: 'Email ja verificado',
      status: 400,
    });
  }

  // Gerar novo token de verificacao
  const token = generateToken();
  const hashedToken = hashToken(token);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: hashedToken },
  });

  let emailSent = false;
  try {
    emailSent = await sendVerificationEmail(user.email, user.name, token);
  } catch (err) {
    logger.error('admin_resend_verification_email_error', { userId: user.id, error: String(err) });
  }

  logger.info('admin_resend_verification', {
    adminId: session.staffId,
    userId: user.id,
    userEmail: user.email,
    emailSent,
  });

  return {
    data: {
      ok: true,
      message: emailSent
        ? 'Email de verificacao reenviado com sucesso'
        : 'Falha ao enviar email de verificacao',
      emailSent,
    },
  };
});
