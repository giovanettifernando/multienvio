export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { ReceptionStatus } from '@prisma/client';

const listSchema = z.object({
  status: z.enum(['all', 'PENDING', 'RECEIVED', 'ISSUE_REPORTED', 'PROCESSED']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
});

async function requireCollectorSession(request: Request) {
  const session = await getCollectorSessionFromRequest(request);
  if (!session) {
    throw NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const point = await prisma.pickupPoint.findUnique({
    where: { id: session.pointId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!point) {
    throw NextResponse.json({ message: 'Ponto não encontrado' }, { status: 404 });
  }

  if (point.status !== 'ACTIVE') {
    throw NextResponse.json(
      { message: 'Ponto de coleta inativo ou bloqueado' },
      { status: 403 }
    );
  }

  return { pointId: point.id };
}

// GET /api/collector/receptions - Listar recepções (com row-level security)
export async function GET(request: Request) {
  try {
    const { pointId } = await requireCollectorSession(request);

    const { searchParams } = new URL(request.url);
    const params = listSchema.parse({
      status: searchParams.get('status') || 'all',
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '10',
    });

    // Construir where clause
    const where: {
      pickupPointId: string;
      status?: ReceptionStatus;
    } = {
      pickupPointId: pointId, // Row-level security: apenas suas recepções
    };

    if (params.status && params.status !== 'all') {
      where.status = params.status as ReceptionStatus;
    }

    // Buscar recepções com paginação
    const [receptions, total] = await Promise.all([
      prisma.reception.findMany({
        where,
        orderBy: [
          { status: 'asc' }, // PENDING primeiro
          { expectedAt: 'asc' }, // Mais antigos primeiro
        ],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          trackingCode: true,
          senderName: true,
          recipientName: true,
          weight: true,
          declaredValue: true,
          status: true,
          expectedAt: true,
          receivedAt: true,
          processedAt: true,
          issueType: true,
          issueDetails: true,
          commissionCents: true,
          createdAt: true,
        },
      }),
      prisma.reception.count({ where }),
    ]);

    return NextResponse.json({
      items: receptions.map((r) => ({
        ...r,
        commissionReais: r.commissionCents / 100,
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Parâmetros inválidos', errors: error.flatten() },
        { status: 400 }
      );
    }
    console.error('[COLLECTOR_RECEPTIONS_LIST]', error);
    return NextResponse.json({ message: 'Erro ao listar recepções' }, { status: 500 });
  }
}
