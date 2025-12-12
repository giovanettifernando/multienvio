import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { AdminPermission } from '@prisma/client';
import { logPasswordReset } from '@/lib/audit-admin';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { staffSessionCache } from '@/lib/cache';

type PasswordResetResponse = {
  message: string;
  tempPassword: string;
};

export const POST = withApiHandler<PasswordResetResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.USUARIOS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  // Rate limiting (Redis distribuido)
  const rateLimitError = await rateLimitByUser(session.staffId, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
  if (rateLimitError) {
    throw new ApiError({ code: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.', status: 429 });
  }

  const { id } = await params;

  const target = await prisma.staffUser.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!target) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

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
