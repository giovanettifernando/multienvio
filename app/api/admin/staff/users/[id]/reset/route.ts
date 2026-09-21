import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '@/platform/db/db';
import { AdminPermission } from '@prisma/client';
import { logPasswordReset } from '@/platform/logging/audit-admin';
import { rateLimitByUser, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { staffSessionCache } from '@/platform/cache/cache';
import { exigirPodeConceder, exigirPodeGerenciar } from '@/modules/admin/application/staff-access';

type PasswordResetResponse = {
  message: string;
  tempPassword: string;
};

export const POST = withApiHandler<PasswordResetResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await requireAdminSession(req, AdminPermission.USUARIOS);

  // Rate limiting (Redis distribuido)
  const rateLimitError = await rateLimitByUser(session.staffId, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
  if (rateLimitError) {
    throw new ApiError({ code: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.', status: 429 });
  }

  const { id } = await params;

  const target = await prisma.staffUser.findUnique({
    where: { id },
    select: { id: true, email: true, isSuperAdmin: true },
  });

  if (!target) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  // A senha temporária volta para quem pediu: com a de um super admin, um staff
  // comum entraria como ele.
  exigirPodeGerenciar(session, target, { mudaAcesso: false });

  const tempPassword = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.staffUser.update({
    where: { id },
    data: {
      passwordHash,
    },
  });

  // Invalidate all existing sessions via Redis
  await staffSessionCache.incrementTokenVersion(id);

  // Audit log
  await logPasswordReset(session.staffId, id, 'StaffUser');

  return {
    data: {
      message: 'Instruções de redefinição de senha enviadas.',
      tempPassword,
    },
  };
});
