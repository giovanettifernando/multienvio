import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission, Prisma, PickupPointStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

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
  paymentMethod: paymentMethodSchema.optional(),
  payoutDay: z.number().min(1).max(31).optional().nullable(),
  minPayoutAmount: z.number().optional().nullable(),
  commissionPerItem: z.number().optional().nullable(),
  capacityPerDay: z.number().optional().nullable(),
});

/**
 * Tipo de resposta para ponto de coleta
 */
interface PickupPointResponse {
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
}

interface GetPickupPointResponse {
  point: PickupPointResponse;
}

interface PatchPickupPointResponse {
  point: PickupPointResponse;
}

interface DeletePickupPointResponse {
  message: string;
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
}): PickupPointResponse {
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

/**
 * GET /api/admin/pickup-points/[id] - Buscar ponto específico
 */
export const GET = withApiHandler<GetPickupPointResponse, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.PONTOS_COLETA);
  if (authResult instanceof Response) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const { id } = params;

  const point = await prisma.pickupPoint.findUnique({
    where: { id },
  });

  if (!point) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ponto não encontrado', status: 404 });
  }

  return { data: { point: toApiPickupPoint(point) } };
});

/**
 * PATCH /api/admin/pickup-points/[id] - Atualizar ponto
 */
export const PATCH = withApiHandler<PatchPickupPointResponse, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.PONTOS_COLETA);
  if (authResult instanceof Response) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const { id } = params;
  const body = await req.json();
  const parsed = updatePickupPointSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  // Verificar se existe
  const existing = await prisma.pickupPoint.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ponto não encontrado', status: 404 });
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
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod as Prisma.InputJsonValue;
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

  return { data: { point: toApiPickupPoint(point) } };
});

/**
 * DELETE /api/admin/pickup-points/[id] - Deletar ponto
 */
export const DELETE = withApiHandler<DeletePickupPointResponse, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.PONTOS_COLETA);
  if (authResult instanceof Response) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const { id } = params;

  const existing = await prisma.pickupPoint.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ponto não encontrado', status: 404 });
  }

  await prisma.pickupPoint.delete({
    where: { id },
  });

  return { data: { message: 'Ponto excluído com sucesso' } };
});
