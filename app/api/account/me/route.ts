import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { UpdateProfileSchema } from '@/lib/validation/profile';
import { logger } from '@/lib/logger';

type UserDto = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatarUrl: string | null;
  hasCompany: boolean;
  cnpj: string | null;
  razaoSocial: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type GetMeResponse = {
  success: boolean;
  user: UserDto;
};

type UpdateMeResponse = {
  success: boolean;
  message: string;
  user: UserDto;
};

/**
 * GET /api/account/me
 * Retorna os dados do usuário autenticado
 */
export const GET = withApiHandler<GetMeResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  // Buscar dados completos do usuário
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      avatarUrl: true,
      hasCompany: true,
      cnpj: true,
      razaoSocial: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  return {
    data: {
      success: true,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * PUT /api/account/me
 * Atualiza os dados do usuário autenticado
 */
export const PUT = withApiHandler<UpdateMeResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const body = await context.req.json();

  // Rejeitar tentativa de alterar email
  if ('email' in body) {
    throw new ApiError({
      code: 'email_immutable',
      message: 'Email não pode ser alterado',
      status: 400,
    });
  }

  // Validar dados com Zod
  const validation = UpdateProfileSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'profile_validation_error', errors: validation.error.flatten() }, 'Profile validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const validated = validation.data;

  logger.info({ event: 'account_me_update', userId: session.userId }, 'Updating account');

  // Atualizar usuário
  const updatedUser = await prisma.user.update({
    where: { id: session.userId },
    data: {
      name: validated.name,
      phone: validated.phone,
      cpf: validated.cpf,
      avatarUrl: validated.avatarUrl,
      hasCompany: validated.hasCompany,
      cnpj: validated.cnpj,
      razaoSocial: validated.razaoSocial,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      avatarUrl: true,
      hasCompany: true,
      cnpj: true,
      razaoSocial: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info({ event: 'account_me_updated', userId: session.userId }, 'Account updated successfully');

  return {
    data: {
      success: true,
      message: 'Dados atualizados com sucesso',
      user: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    },
  };
});
