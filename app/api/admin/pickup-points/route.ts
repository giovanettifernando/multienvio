export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, PickupPointStatus, Prisma } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';
import { Decimal } from '@prisma/client/runtime/library';

// Schema de validação
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

const createPickupPointSchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().min(1),
  cnpj: z.string().min(14).max(18), // Aceita com ou sem formatação
  ie: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().or(z.literal('')),
  cep: z.string().optional().or(z.literal('')),
  logradouro: z.string().optional().or(z.literal('')),
  numero: z.string().optional().or(z.literal('')),
  complemento: z.string().optional().or(z.literal('')),
  bairro: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  uf: z.string().length(2).optional().or(z.literal('')),
  paymentMethod: paymentMethodSchema,
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

// GET /api/admin/pickup-points - Lista pontos de coleta
export async function GET(request: Request) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.PONTOS_COLETA)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const uf = searchParams.get('uf');
    const cidade = searchParams.get('cidade');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // Construir where clause
    const where: {
      status?: PickupPointStatus;
      uf?: string;
      cidade?: { contains: string; mode: 'insensitive' };
      OR?: Array<{
        razaoSocial?: { contains: string; mode: 'insensitive' };
        nomeFantasia?: { contains: string; mode: 'insensitive' };
        cnpj?: { contains: string };
        cidade?: { contains: string; mode: 'insensitive' };
        uf?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (status && status !== 'all') {
      where.status = status as PickupPointStatus;
    }

    if (uf) {
      where.uf = uf.toUpperCase();
    }

    if (cidade) {
      where.cidade = {
        contains: cidade,
        mode: 'insensitive',
      };
    }

    if (q) {
      where.OR = [
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { nomeFantasia: { contains: q, mode: 'insensitive' } },
        { cnpj: { contains: q } },
        { cidade: { contains: q, mode: 'insensitive' } },
        { uf: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Buscar com paginação
    const [items, total] = await Promise.all([
      prisma.pickupPoint.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pickupPoint.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(toApiPickupPoint),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_PICKUP_POINTS_LIST]', error);
    return NextResponse.json({ message: 'Erro ao listar pontos' }, { status: 500 });
  }
}

// POST /api/admin/pickup-points - Criar novo ponto
export async function POST(request: Request) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.PONTOS_COLETA)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[ADMIN_PICKUP_POINTS_CREATE] Body received:', JSON.stringify(body, null, 2));
    const data = createPickupPointSchema.parse(body);

    // Normalizar CNPJ (remover formatação)
    const cnpj = data.cnpj.replace(/\D/g, '');

    // Verificar se CNPJ já existe
    const existing = await prisma.pickupPoint.findUnique({
      where: { cnpj },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'CNPJ já cadastrado' },
        { status: 400 }
      );
    }

    // Hash da senha se fornecida
    let passwordHash: string | null = null;
    if (data.password && data.password.trim() !== '') {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    const point = await prisma.pickupPoint.create({
      data: {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpj, // CNPJ normalizado
        ie: data.ie || null,
        email: data.email || null,
        telefone: data.telefone || null,
        passwordHash,
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        paymentMethod: data.paymentMethod as unknown as Prisma.InputJsonValue,
        payoutDay: data.payoutDay || null,
        minPayoutAmount: data.minPayoutAmount ? new Decimal(data.minPayoutAmount) : null,
        commissionPerItem: data.commissionPerItem ? new Decimal(data.commissionPerItem) : null,
        capacityPerDay: data.capacityPerDay || null,
      },
    });

    return NextResponse.json({ point: toApiPickupPoint(point) }, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    if (error instanceof z.ZodError) {
      console.error('[ADMIN_PICKUP_POINTS_CREATE] Validation error:', JSON.stringify(error.flatten(), null, 2));
      return NextResponse.json(
        { message: 'Dados inválidos', errors: error.flatten() },
        { status: 400 }
      );
    }
    console.error('[ADMIN_PICKUP_POINTS_CREATE] Error:', error);
    return NextResponse.json({ message: 'Erro ao criar ponto' }, { status: 500 });
  }
}
