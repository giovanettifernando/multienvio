/**
 * Helpers para autenticação obrigatória em rotas
 *
 * Estes helpers simplificam o padrão de verificação de sessão + throw de erro,
 * eliminando código duplicado em ~60+ rotas.
 */

import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest, type JWTPayload } from '@/modules/auth/application/session';
import { getUserSessionFromRequest, type UserSession } from '@/modules/auth/application/user-session';
import {
  getAdminSessionFromRequest,
  type AdminJWTPayload,
} from '@/modules/auth/application/admin-session';
import type { AdminPermission } from '@prisma/client';

/**
 * Requer sessão de usuário autenticado
 *
 * @param req Request object
 * @returns JWTPayload com dados do usuário
 * @throws ApiError 401 se não autenticado
 *
 * @example
 * const session = await requireUserSession(context.req);
 * // session.userId está garantidamente disponível aqui
 */
export async function requireUserSession(req: Request): Promise<JWTPayload> {
  const session = await getUserFromRequest(req);
  if (!session?.userId) {
    throw new ApiError({
      code: 'unauthorized',
      message: 'Não autenticado',
      status: 401,
    });
  }
  return session;
}

/**
 * Requer sessão de usuário (versão simplificada)
 *
 * @param req Request object
 * @returns UserSession com userId, email e role
 * @throws ApiError 401 se não autenticado
 */
export async function requireUser(req: Request): Promise<UserSession> {
  const session = await getUserSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'unauthorized',
      message: 'Não autenticado',
      status: 401,
    });
  }
  return session;
}

/**
 * Requer sessão de admin autenticado
 *
 * @param req Request object
 * @param permission Permissão opcional requerida (além de autenticação)
 * @returns AdminJWTPayload com dados do admin
 * @throws ApiError 401 se não autenticado
 * @throws ApiError 403 se não tem permissão requerida
 *
 * @example
 * // Apenas autenticação
 * const session = await requireAdminSession(req);
 *
 * // Com permissão específica
 * const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);
 */
export async function requireAdminSession(
  req: Request,
  permission?: AdminPermission
): Promise<AdminJWTPayload> {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'unauthorized',
      message: 'Não autenticado',
      status: 401,
    });
  }

  // Verificar permissão se especificada (superAdmin sempre tem acesso)
  if (permission && !session.isSuperAdmin && !session.permissions.includes(permission)) {
    throw new ApiError({
      code: 'forbidden',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  return session;
}


