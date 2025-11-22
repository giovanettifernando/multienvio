/**
 * API Route para atualizar status do coletor
 * PATCH /api/admin/coletores/[id]/status - Atualiza status (active/blocked)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { updateCollectorStatus } from '@/lib/collectors/service';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const statusSchema = z.object({
  status: z.enum(['active', 'blocked']),
});

/**
 * PATCH /api/admin/coletores/[id]/status
 * Atualiza o status de um coletor
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.COLETORES);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate status
    const { status } = statusSchema.parse(body);

    const collector = await updateCollectorStatus(id, status);

    return NextResponse.json(
      {
        collector,
        message: `Coletor ${status === 'active' ? 'ativado' : 'bloqueado'} com sucesso`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[PATCH /api/admin/coletores/status] Error:`, error);

    // Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          message: 'Status inválido',
          errors: error,
        },
        { status: 400 }
      );
    }

    // Prisma not found error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { message: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao atualizar status',
      },
      { status: 500 }
    );
  }
}
