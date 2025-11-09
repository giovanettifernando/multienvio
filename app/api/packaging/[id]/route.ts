export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSession } from '@/lib/auth/session';
import { packagingUpdateSchema } from '@/lib/validation/packaging';
import * as packagingService from '@/lib/services/packaging';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/packaging/[id]
 * Atualiza uma embalagem existente do usuário
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = packagingUpdateSchema.parse(body);

    const template = await packagingService.update(session.userId, id, data);

    // Converter Decimal para number no response
    const result = {
      id: template.id,
      name: template.name,
      lengthCm: Number(template.lengthCm),
      widthCm: Number(template.widthCm),
      heightCm: Number(template.heightCm),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Embalagem não encontrada') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error('[PACKAGING_UPDATE]', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar embalagem' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/packaging/[id]
 * Remove uma embalagem do usuário
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    await packagingService.remove(session.userId, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Embalagem não encontrada') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error('[PACKAGING_DELETE]', error);
    return NextResponse.json(
      { message: 'Erro ao remover embalagem' },
      { status: 500 }
    );
  }
}
