import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { ReceptionStatus, Prisma } from '@prisma/client';

const receiveSchema = z.object({
  hasIssue: z.boolean(),
  issueType: z.enum(['damaged', 'incomplete', 'wrong_address', 'other']).optional(),
  issueDetails: z.string().optional(),
  issuePhotos: z.array(z.string()).optional(), // Array de URLs
});

type ReceiveReceptionResponse = {
  message: string;
  reception: {
    id: string;
    status: ReceptionStatus;
    receivedAt: string | null;
  };
};

async function requireCollectorSession(request: Request) {
  const session = await getCollectorSessionFromRequest(request);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  const point = await prisma.pickupPoint.findUnique({
    where: { id: session.pointId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!point) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ponto não encontrado', status: 404 });
  }

  if (point.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Ponto de coleta inativo ou bloqueado',
      status: 403,
    });
  }

  return { pointId: point.id };
}

// POST /api/pontos-coleta/receptions/[id]/receive - Marcar como recebido
export const POST = withApiHandler<ReceiveReceptionResponse, { id: string }>(async ({ req, params }) => {
  const { pointId } = await requireCollectorSession(req);
  const body = await req.json();
  const data = receiveSchema.parse(body);

  // Buscar recepção (row-level security)
  const reception = await prisma.reception.findFirst({
    where: {
      id: params.id,
      pickupPointId: pointId, // Garantir que pertence a este ponto
    },
  });

  if (!reception) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Recepção não encontrada', status: 404 });
  }

  // Verificar se já foi recebida
  if (reception.status !== ReceptionStatus.PENDING) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Esta recepção já foi processada',
      status: 400,
    });
  }

  // Atualizar status
  const newStatus = data.hasIssue
    ? ReceptionStatus.ISSUE_REPORTED
    : ReceptionStatus.RECEIVED;

  const updated = await prisma.reception.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      receivedAt: new Date(),
      issueType: data.hasIssue ? data.issueType : null,
      issueDetails: data.hasIssue ? data.issueDetails : null,
      issuePhotos: data.hasIssue && data.issuePhotos ? data.issuePhotos : Prisma.JsonNull,
    },
  });

  return {
    data: {
      message: data.hasIssue
        ? 'Recepção marcada com problema'
        : 'Recepção confirmada com sucesso',
      reception: {
        id: updated.id,
        status: updated.status,
        receivedAt: updated.receivedAt?.toISOString() ?? null,
      },
    },
  };
});
