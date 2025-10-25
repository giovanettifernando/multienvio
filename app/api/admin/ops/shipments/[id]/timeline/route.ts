import { NextRequest, NextResponse } from 'next/server';
import type { TimelineEvent } from '@/lib/admin/ops/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
