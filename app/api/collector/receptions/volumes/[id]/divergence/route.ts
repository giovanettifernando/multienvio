/**
 * API Route para registrar divergência de volume
 * POST /api/collector/receptions/volumes/[id]/divergence
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const DivergenceSchema = z.object({
  divergenceType: z.enum(['DIMENSAO', 'PESO', 'DIMENSAO_E_PESO']),
  newWidth: z.number().positive().optional(),
  newHeight: z.number().positive().optional(),
  newLength: z.number().positive().optional(),
  newWeight: z.number().positive().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/collector/receptions/volumes/[id]/divergence
 * Registra divergência em um volume
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = DivergenceSchema.parse(body);

    // Buscar o volume
    const packageItem = await prisma.package.findUnique({
      where: { id },
    });

    if (!packageItem) {
      return NextResponse.json({ message: 'Volume não encontrado' }, { status: 404 });
    }

    // Validar campos obrigatórios conforme tipo de divergência
    if (
      (validatedData.divergenceType === 'DIMENSAO' ||
        validatedData.divergenceType === 'DIMENSAO_E_PESO') &&
      (!validatedData.newWidth || !validatedData.newHeight || !validatedData.newLength)
    ) {
      return NextResponse.json(
        { message: 'Novas dimensões são obrigatórias para divergência de dimensão' },
        { status: 400 }
      );
    }

    if (
      (validatedData.divergenceType === 'PESO' ||
        validatedData.divergenceType === 'DIMENSAO_E_PESO') &&
      !validatedData.newWeight
    ) {
      return NextResponse.json(
        { message: 'Novo peso é obrigatório para divergência de peso' },
        { status: 400 }
      );
    }

    // Registrar divergência
    const updatedPackage = await prisma.package.update({
      where: { id },
      data: {
        hasDivergence: true,
        divergenceType: validatedData.divergenceType,
        divergenceWidth: validatedData.newWidth,
        divergenceHeight: validatedData.newHeight,
        divergenceLength: validatedData.newLength,
        divergenceWeight: validatedData.newWeight,
        divergenceNotes: validatedData.notes,
        divergenceRegisteredAt: new Date(),
        divergenceRegisteredBy: 'collector-user', // TODO: Pegar ID do usuário autenticado
      },
    });

    return NextResponse.json({
      message: 'Divergência registrada com sucesso',
      package: {
        id: updatedPackage.id,
        packageNumber: updatedPackage.packageNumber,
        hasDivergence: updatedPackage.hasDivergence,
        divergenceType: updatedPackage.divergenceType,
      },
    });
  } catch (error) {
    console.error('[DIVERGENCE_POST]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Dados inválidos', details: error.message },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Erro ao registrar divergência';
    return NextResponse.json({ message }, { status: 500 });
  }
}
