import { prisma } from '@/platform/db/db';
import { requireAdminSession } from '@/platform/auth/require-session';
import { PickupPointStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

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
  const session = await requireAdminSession(req);

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
