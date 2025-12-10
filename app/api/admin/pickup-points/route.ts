import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, PickupPointStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

type PickupPointApi = {
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
  minPayoutAmount: number | null;
  commissionPerItem: number | null;
  capacityPerDay: number | null;
  monthlyReceived: number;
  createdAt: string;
  updatedAt: string;
};

type PickupPointsListResponse = {
  items: PickupPointApi[];
  total: number;
  page: number;
  pageSize: number;
};

type PickupPointCreateResponse = {
  point: PickupPointApi;
};

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

// GET /api/admin/pickup-points - Lista pontos de coleta
export const GET = withApiHandler<PickupPointsListResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.PONTOS_COLETA) && !session.isSuperAdmin) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const { searchParams } = new URL(req.url);
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

  logger.info('admin_pickup_points_list', { staffId: session.staffId, total, page });

  return {
    data: {
      items: items.map(toApiPickupPoint),
      total,
      page,
      pageSize,
    },
  };
});

// POST /api/admin/pickup-points - Criar novo ponto
export const POST = withApiHandler<PickupPointCreateResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.PONTOS_COLETA) && !session.isSuperAdmin) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const body = await req.json();
  logger.debug('admin_pickup_points_create_body', { body });

  const validation = createPickupPointSchema.safeParse(body);
  if (!validation.success) {
    logger.debug('admin_pickup_points_create_validation_error', { errors: validation.error.flatten() });
    throw new ApiError({
      code: 'validation_error',
      message: 'Dados inválidos',
      status: 400,
      details: { errors: validation.error.flatten() },
    });
  }

  const data = validation.data;

  // Normalizar CNPJ (remover formatação)
  const cnpj = data.cnpj.replace(/\D/g, '');

  // Verificar se CNPJ já existe
  const existing = await prisma.pickupPoint.findUnique({
    where: { cnpj },
  });

  if (existing) {
    throw new ApiError({ code: 'duplicate', message: 'CNPJ já cadastrado', status: 400 });
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

  logger.info('admin_pickup_point_created', { staffId: session.staffId, pointId: point.id });

  return {
    data: { point: toApiPickupPoint(point) },
    status: 201,
  };
});
