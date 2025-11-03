export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, Prisma } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';
import { Decimal } from '@prisma/client/runtime/library';

const pixMethodSchema = z.object({
  kind: z.literal('pix'),
  pixType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
  pixKey: z.string().min(1),
});

const transferMethodSchema = z.object({
  kind: z.literal('transfer'),
  bankCode: z.string().min(3).max(3),
  branch: z.string().min(1),
  account: z.string().min(1),
  accountType: z.enum(['corrente', 'poupanca']),
  holderName: z.string().min(1),
  holderDocument: z.string().min(11).max(14),
});

const paymentMethodSchema = z.union([pixMethodSchema, transferMethodSchema]);

const updatePickupPointSchema = z.object({
  razaoSocial: z.string().min(1).optional(),
  nomeFantasia: z.string().min(1).optional(),
  ie: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')).refine(
    (val) => !val || val === '' || val.length >= 6,
    { message: 'Senha deve ter no mínimo 6 caracteres' }
  ),
  cep: z.string().optional().or(z.literal('')),
  logradouro: z.string().optional().or(z.literal('')),
  numero: z.string().optional().or(z.literal('')),
  complemento: z.string().optional().or(z.literal('')),
  bairro: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  uf: z.string().length(2).optional().or(z.literal('')),
  geo: z.object({
    lat: z.number(),
    lng: z.number(),
  }).nullable().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  payoutDay: z.number().min(1).max(31).optional().nullable(),
  minPayoutAmount: z.number().optional().nullable(),
  commissionPerItem: z.number().optional().nullable(),
  capacityPerDay: z.number().optional().nullable(),
});

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
  status: import('@prisma/client').PickupPointStatus;
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
  geo: unknown;
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
    geo: point.geo,
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

// GET /api/admin/pickup-points/[id] - Buscar ponto específico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.PONTOS_COLETA)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;

    const point = await prisma.pickupPoint.findUnique({
      where: { id },
    });

    if (!point) {
      return NextResponse.json({ message: 'Ponto não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ point: toApiPickupPoint(point) });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_PICKUP_POINT_GET]', error);
    return NextResponse.json({ message: 'Erro ao buscar ponto' }, { status: 500 });
  }
}

// PATCH /api/admin/pickup-points/[id] - Atualizar ponto
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.PONTOS_COLETA)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updatePickupPointSchema.parse(body);

    // Verificar se existe
    const existing = await prisma.pickupPoint.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Ponto não encontrado' }, { status: 404 });
    }

    // Preparar dados para update
    const updateData: Prisma.PickupPointUpdateInput = {};

    if (data.razaoSocial !== undefined) updateData.razaoSocial = data.razaoSocial;
    if (data.nomeFantasia !== undefined) updateData.nomeFantasia = data.nomeFantasia;
    if (data.ie !== undefined) updateData.ie = data.ie;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.telefone !== undefined) updateData.telefone = data.telefone;

    // Hash da senha se fornecida
    if (data.password !== undefined && data.password && data.password.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    if (data.cep !== undefined) updateData.cep = data.cep;
    if (data.logradouro !== undefined) updateData.logradouro = data.logradouro;
    if (data.numero !== undefined) updateData.numero = data.numero;
    if (data.complemento !== undefined) updateData.complemento = data.complemento;
    if (data.bairro !== undefined) updateData.bairro = data.bairro;
    if (data.cidade !== undefined) updateData.cidade = data.cidade;
    if (data.uf !== undefined) updateData.uf = data.uf;
    if (data.geo !== undefined) updateData.geo = data.geo ? data.geo : Prisma.JsonNull;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod as unknown as Prisma.InputJsonValue;
    if (data.payoutDay !== undefined) updateData.payoutDay = data.payoutDay;
    if (data.minPayoutAmount !== undefined) {
      updateData.minPayoutAmount = data.minPayoutAmount ? new Decimal(data.minPayoutAmount) : null;
    }
    if (data.commissionPerItem !== undefined) {
      updateData.commissionPerItem = data.commissionPerItem ? new Decimal(data.commissionPerItem) : null;
    }
    if (data.capacityPerDay !== undefined) updateData.capacityPerDay = data.capacityPerDay;

    const point = await prisma.pickupPoint.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ point: toApiPickupPoint(point) });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: error.flatten() },
        { status: 400 }
      );
    }
    console.error('[ADMIN_PICKUP_POINT_UPDATE]', error);
    return NextResponse.json({ message: 'Erro ao atualizar ponto' }, { status: 500 });
  }
}

// DELETE /api/admin/pickup-points/[id] - Deletar ponto
export async function DELETE(
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

    await prisma.pickupPoint.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Ponto excluído com sucesso' });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_PICKUP_POINT_DELETE]', error);
    return NextResponse.json({ message: 'Erro ao excluir ponto' }, { status: 500 });
  }
}
