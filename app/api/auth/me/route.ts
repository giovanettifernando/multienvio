import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { UserStatus, AuthRole, type User } from '@/types/contracts';

interface MeResponse {
  user: User;
}

export const GET = withApiHandler<MeResponse>(async (context) => {
  const { req, logger } = context;

  // Obter sessão do cookie JWT diretamente do request (mais confiável que cookies() API)
  const session = await getUserFromRequest(req);

  if (!session) {
    throw new ApiError({
      code: 'unauthorized',
      message: 'Não autenticado',
      status: 401,
    });
  }

  // Buscar usuário no banco
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      role: true,
    },
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
  const user: User = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    phone: dbUser.phone,
    avatarUrl: dbUser.avatarUrl,
    status: dbUser.status as UserStatus,
    roles: dbUser.role?.name === 'admin' ? [AuthRole.ADMIN] : [],
    lastLoginAt: dbUser.lastLoginAt?.toISOString() || null,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
  };

  return { data: { user } };
});
