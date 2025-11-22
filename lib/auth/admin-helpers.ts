import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from './admin-session';
import { requirePermission } from './permissions';
import { prisma } from '@/lib/db';
import type { AdminPermission, StaffUser } from '@prisma/client';
import type { AdminJWTPayload } from './admin-session';

export interface AdminUserContext {
  session: AdminJWTPayload;
  user: StaffUser;
}

/**
 * Helper que valida autenticação, status ACTIVE e permissões em uma única chamada
 *
 * @param request - Request do Next.js
 * @param permission - Permissão necessária (opcional, para super admins)
 * @returns Contexto com sessão e usuário completo, ou NextResponse com erro
 *
 * @example
 * const result = await requireAdminUser(request, AdminPermission.FINANCEIRO);
 * if (result instanceof NextResponse) return result;
 * const { session, user } = result;
 */
export async function requireAdminUser(
  request: Request,
  permission?: AdminPermission
): Promise<AdminUserContext | NextResponse> {
  // 1. Validar sessão (já inclui validação de tokenVersion e status ACTIVE)
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  // 2. Validar permissão se necessária
  if (permission) {
    const permissionError = requirePermission(session, permission);
    if (permissionError) return permissionError;
  }

  // 3. Buscar usuário completo do banco (para ter todos os dados disponíveis)
  const user = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
  });

  if (!user) {
    return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
  }

  // 4. Verificação de segurança adicional (defesa em profundidade)
  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ message: 'Conta inativa ou bloqueada' }, { status: 403 });
  }

  return { session, user };
}

/**
 * Valida apenas autenticação e status, sem verificar permissões
 * Útil para rotas que não exigem permissões específicas (ex: /me, /logout)
 */
export async function requireAdminAuth(
  request: Request
): Promise<AdminUserContext | NextResponse> {
  return requireAdminUser(request);
}
