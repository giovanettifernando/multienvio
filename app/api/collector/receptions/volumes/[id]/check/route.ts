/**
 * API Route para marcar volume como conferido
 * POST /api/collector/receptions/volumes/[id]/check
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/collector/receptions/volumes/[id]/check
 * Marca volume como conferido
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Buscar o volume
    const packageItem = await prisma.package.findUnique({
      where: { id },
    });

    if (!packageItem) {
      return NextResponse.json({ message: 'Volume não encontrado' }, { status: 404 });
    }

    // Verificar se já foi conferido
    if (packageItem.checkedAt) {
      return NextResponse.json(
        { message: 'Este volume já foi conferido' },
        { status: 400 }
      );
    }

    // Marcar como conferido
    const updatedPackage = await prisma.package.update({
      where: { id },
      data: {
        checkedAt: new Date(),
        checkedBy: 'collector-user', // TODO: Pegar ID do usuário autenticado
      },
    });

    return NextResponse.json({
      message: 'Volume conferido com sucesso',
      package: {
        id: updatedPackage.id,
        packageNumber: updatedPackage.packageNumber,
        checkedAt: updatedPackage.checkedAt,
      },
    });
  } catch (error) {
    console.error('[CHECK_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao conferir volume';
    return NextResponse.json({ message }, { status: 500 });
  }
}
