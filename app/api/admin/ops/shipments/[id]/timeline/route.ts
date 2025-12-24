import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import type { TimelineEvent } from '@/modules/admin/application/ops/types';

export const GET = withApiHandler<TimelineEvent[], { id: string }>(async (context) => {
  const { req, params } = context;

  await requireAdminSession(req, AdminPermission.OPERACOES);

  await params;

  // TODO: Implementar consulta real ao banco de dados
  const timeline: TimelineEvent[] = [
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

  return { data: timeline };
});
