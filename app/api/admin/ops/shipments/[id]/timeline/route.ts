import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import type { TimelineEvent } from '@/lib/admin/ops/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  await params;

  const mockTimeline: TimelineEvent[] = [
    {
      timestamp: '2025-01-23T10:00:00Z',
      status: 'created',
      description: 'Pedido criado',
      location: 'Sistema',
    },
    {
      timestamp: '2025-01-23T10:15:00Z',
      status: 'awaiting_dropoff',
      description: 'Aguardando entrega no PoC',
      location: 'PoC Centro SP',
    },
    {
      timestamp: '2025-01-23T14:30:00Z',
      status: 'received_at_poc',
      description: 'Recebido no ponto de coleta',
      location: 'PoC Centro SP',
    },
    {
      timestamp: '2025-01-23T16:00:00Z',
      status: 'in_pickup',
      description: 'Coletado pela transportadora',
      location: 'PoC Centro SP',
    },
  ];

  return NextResponse.json(mockTimeline);
}
