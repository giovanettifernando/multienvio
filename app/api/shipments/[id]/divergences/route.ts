/**
 * API Route para buscar divergências de volumes de um shipment
 * GET /api/shipments/[id]/divergences
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Buscar o shipment e verificar se pertence ao usuário
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      select: {
        id: true,
        senderId: true,
        packages: {
          where: {
            hasDivergence: true, // Apenas volumes com divergência
          },
          select: {
            id: true,
            packageNumber: true,
            hasDivergence: true,
            divergenceType: true,
            width: true,
            height: true,
            length: true,
            weight: true,
            divergenceWidth: true,
            divergenceHeight: true,
            divergenceLength: true,
            divergenceWeight: true,
            divergenceNotes: true,
            divergencePhotoUrl: true,
            divergenceRegisteredAt: true,
            divergenceRegisteredBy: true,
          },
          orderBy: {
            packageNumber: 'asc',
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Envio não encontrado' }, { status: 404 });
    }

    // Verificar se o shipment pertence ao usuário
    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Mapear packages para o formato do DTO
    const divergences = shipment.packages.map((pkg) => {
      // Determinar tipo de divergência
      let type: 'DIMENSAO' | 'PESO' | 'DIMENSAO_E_PESO' = 'DIMENSAO';
      if (pkg.divergenceType === 'PESO') {
        type = 'PESO';
      } else if (pkg.divergenceType === 'DIMENSAO_E_PESO') {
        type = 'DIMENSAO_E_PESO';
      }

      return {
        id: pkg.id,
        volumeLabel: `#${pkg.packageNumber}`,
        registeredDimensions:
          pkg.width && pkg.height && pkg.length
            ? {
                widthCm: pkg.width,
                heightCm: pkg.height,
                lengthCm: pkg.length,
              }
            : undefined,
        registeredWeightKg: pkg.weight || undefined,
        type,
        newDimensions:
          pkg.divergenceWidth && pkg.divergenceHeight && pkg.divergenceLength
            ? {
                widthCm: pkg.divergenceWidth,
                heightCm: pkg.divergenceHeight,
                lengthCm: pkg.divergenceLength,
              }
            : undefined,
        newWeightKg: pkg.divergenceWeight || undefined,
        observations: pkg.divergenceNotes || undefined,
        photoUrl: pkg.divergencePhotoUrl || null,
        createdAt: pkg.divergenceRegisteredAt?.toISOString() || new Date().toISOString(),
        collectorName: pkg.divergenceRegisteredBy || undefined,
        // pickupPointName: Não temos esse relacionamento ainda, deixar undefined
      };
    });

    return NextResponse.json({ divergences });
  } catch (error) {
    console.error('[SHIPMENTS_DIVERGENCES_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar divergências' },
      { status: 500 }
    );
  }
}
