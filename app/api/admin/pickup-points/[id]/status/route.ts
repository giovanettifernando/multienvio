export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, PickupPointStatus } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';
import { Decimal } from '@prisma/client/runtime/library';

async function requireAdminUser(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    throw NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: {
      id: true,
      status: true,
      isSuperAdmin: true,
      permissions: true,
    },
  });

  if (!staffUser) {
    throw NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
  }

  if (staffUser.status !== 'ACTIVE') {
    throw NextResponse.json({ message: 'Conta inativa ou bloqueada' }, { status: 403 });
  }

  return staffUser;
}

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
    // geo removido - usar CEP para geolocalização
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
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.PONTOS_COLETA)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.pickupPoint.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Ponto não encontrado' }, { status: 404 });
    }

    // Toggle status
    const newStatus = existing.status === PickupPointStatus.ACTIVE
      ? PickupPointStatus.BLOCKED
      : PickupPointStatus.ACTIVE;

    const point = await prisma.pickupPoint.update({
      where: { id },
      data: { status: newStatus },
    });

    return NextResponse.json({ point: toApiPickupPoint(point) });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_PICKUP_POINT_TOGGLE_STATUS]', error);
    return NextResponse.json({ message: 'Erro ao atualizar status' }, { status: 500 });
  }
}
