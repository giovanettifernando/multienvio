/**
 * API Routes para Coletor Individual
 * GET    /api/admin/coletores/[id] - Busca coletor por ID
 * PATCH  /api/admin/coletores/[id] - Atualiza coletor
 * DELETE /api/admin/coletores/[id] - Deleta coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import {
  getCollectorById,
  updateCollector,
  deleteCollector,
} from '@/lib/collectors/service';
import { collectorFormSchema } from '@/lib/collectors/schemas';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/admin/coletores/[id]
 * Busca um coletor por ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.COLETORES);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    const collector = await getCollectorById(id);

    if (!collector) {
      return NextResponse.json(
        { message: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collector }, { status: 200 });
  } catch (error) {
    console.error(`[GET /api/admin/coletores] Error:`, error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao buscar coletor',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/coletores/[id]
 * Atualiza um coletor
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate with Zod schema
    const validatedData = collectorFormSchema.parse(body);

    const collector = await updateCollector(id, validatedData);

    return NextResponse.json(
      { collector, message: 'Coletor atualizado com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[PATCH /api/admin/coletores] Error:`, error);

    // Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
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
        message: error instanceof Error ? error.message : 'Erro ao atualizar coletor',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/coletores/[id]
 * Deleta um coletor
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    await deleteCollector(id);

    return NextResponse.json(
      { message: 'Coletor excluído com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[DELETE /api/admin/coletores] Error:`, error);

    // Prisma not found error
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { message: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao excluir coletor',
      },
      { status: 500 }
    );
  }
}
