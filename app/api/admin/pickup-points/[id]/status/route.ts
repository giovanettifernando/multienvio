import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, PickupPointStatus } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';
import { Decimal } from '@prisma/client/runtime/client';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

function toApiPickupPoint(point: {
  id: string;
  status: PickupPointStatus;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  paymentMethod: unknown;
  payoutDay: number | null;
  minPayoutAmount: Decimal | null;
  commissionPerItem: Decimal | null;
  capacityPerDay: number | null;
  monthlyReceived: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: point.id,
    status: point.status,
    razaoSocial: point.razaoSocial,
    nomeFantasia: point.nomeFantasia,
    cnpj: point.cnpj,
    ie: point.ie,
    email: point.email,
    telefone: point.telefone,
    cep: point.cep,
    logradouro: point.logradouro,
    numero: point.numero,
    complemento: point.complemento,
    bairro: point.bairro,
    cidade: point.cidade,
    uf: point.uf,
    paymentMethod: point.paymentMethod,
    payoutDay: point.payoutDay,
    minPayoutAmount: point.minPayoutAmount ? parseFloat(point.minPayoutAmount.toString()) : null,
    commissionPerItem: point.commissionPerItem ? parseFloat(point.commissionPerItem.toString()) : null,
    capacityPerDay: point.capacityPerDay,
    monthlyReceived: point.monthlyReceived,
    createdAt: point.createdAt.toISOString(),
    updatedAt: point.updatedAt.toISOString(),
  };
}

// POST /api/admin/pickup-points/[id]/status - Toggle status
export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { id: true, status: true, isSuperAdmin: true, permissions: true },
  });

  if (!staffUser) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Usuário não encontrado', status: 404 });
  }

  if (staffUser.status !== 'ACTIVE') {
    throw new ApiError({ code: 'FORBIDDEN', message: 'Conta inativa ou bloqueada', status: 403 });
  }

  if (!canAccess(staffUser, AdminPermission.PONTOS_COLETA)) {
    throw new ApiError({ code: 'FORBIDDEN', message: 'Acesso negado', status: 403 });
  }

  const { id } = params;

  const existing = await prisma.pickupPoint.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ponto não encontrado', status: 404 });
  }

  // Toggle status
  const newStatus = existing.status === PickupPointStatus.ACTIVE
    ? PickupPointStatus.BLOCKED
    : PickupPointStatus.ACTIVE;

  const point = await prisma.pickupPoint.update({
    where: { id },
    data: { status: newStatus },
  });

  return { data: { point: toApiPickupPoint(point) } };
});
