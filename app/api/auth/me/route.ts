import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { userCache, CacheTTL } from '@/platform/cache/cache';
import { UserStatus, AuthRole, type User } from '@/shared/types/contracts';

interface MeResponse {
  user: User;
}

export const GET = withApiHandler<MeResponse>(async (context) => {
  const { req, logger } = context;

  // Obter sessão do cookie JWT diretamente do request (mais confiável que cookies() API)
  const session = await requireUserSession(req);

  // Verificar cache primeiro (TTL 5 minutos)
  // Usa userCache.get(userId) para garantir consistência com userCache.invalidate(userId)
  const cached = await userCache.get<User>(session.userId);
  if (cached) {
    // Verificar se usuário ainda está ativo no cache
    if (cached.status !== UserStatus.ACTIVE) {
      throw new ApiError({
        code: 'forbidden',
        message: 'Conta inativa ou bloqueada',
        status: 403,
      });
    }
    return { data: { user: cached } };
  }

  // Buscar usuário no banco
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!dbUser) {
    throw new ApiError({
      code: 'not_found',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  // Verificar se usuário está ativo
  if (dbUser.status !== UserStatus.ACTIVE) {
    throw new ApiError({
      code: 'forbidden',
      message: 'Conta inativa ou bloqueada',
      status: 403,
    });
  }

  logger.info('auth_me_success', { userId: dbUser.id });

  // Mapear para o tipo User global (sem expor passwordHash)
  // Note: Role removido do User - admin access via StaffUser.permissions
  const user: User = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    phone: dbUser.phone,
    avatarUrl: dbUser.avatarUrl,
    status: dbUser.status as UserStatus,
    roles: [], // Role removido do User - admin access via StaffUser
    lastLoginAt: dbUser.lastLoginAt?.toISOString() || null,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
  };

  // Salvar no cache (fire and forget)
  // Usa userCache.set(userId, data) para garantir consistência com userCache.invalidate(userId)
  userCache.set(session.userId, user).catch(() => {});

  return { data: { user } };
});
