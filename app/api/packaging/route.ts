export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSession } from '@/lib/auth/session';
import { packagingCreateSchema } from '@/lib/validation/packaging';
import * as packagingService from '@/lib/services/packaging';

/**
 * GET /api/packaging
 * Lista todas as embalagens do usuário autenticado
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const templates = await packagingService.listByUser(session.userId);

    // Converter Decimal para number no response
    const result = templates.map((t) => ({
      id: t.id,
      name: t.name,
      lengthCm: Number(t.lengthCm),
      widthCm: Number(t.widthCm),
      heightCm: Number(t.heightCm),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PACKAGING_LIST]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar embalagens' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/packaging
 * Cria uma nova embalagem para o usuário autenticado
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const data = packagingCreateSchema.parse(body);

    const template = await packagingService.create(session.userId, data);

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

    return NextResponse.json(result, { status: 201 });
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

    console.error('[PACKAGING_CREATE]', error);
    return NextResponse.json(
      { message: 'Erro ao criar embalagem' },
      { status: 500 }
    );
  }
}
