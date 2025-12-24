/**
 * GET /api/admin/config/comissoes
 * POST /api/admin/config/comissoes
 *
 * Rotas de configuração das comissões da plataforma (Admin)
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

import { AdminPermission } from '@prisma/client';

/**
 * Schema de validação para configuração de comissões
 * Nota: shippingCommissionPercent foi movido para configuração por transportadora (Carrier)
 */
const commissionConfigSchema = z.object({
  pickupFeeCommissionPercent: z
    .number()
    .min(0, 'Comissão não pode ser negativa')
    .max(100, 'Comissão não pode exceder 100%'),
  isActive: z.boolean().default(true),
});

/**
 * Tipo de resposta da configuração de comissões
 * Nota: shippingCommissionPercent foi movido para configuração por transportadora
 */
interface CommissionConfigResponse {
  configured: boolean;
  pickupFeeCommissionPercent: number;
  isActive: boolean;
  id: string | null;
  updatedAt: Date | null;
  updatedById: string | null;
}

/**
 * GET - Retorna a configuração atual de comissões
 */
export const GET = withApiHandler<CommissionConfigResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);

  // Buscar configuração ativa (singleton - pega a mais recente)
  const config = await prisma.platformCommission.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!config) {
    // Retornar valores padrão se não houver configuração
    return {
      data: {
        configured: false,
        pickupFeeCommissionPercent: 0,
        isActive: true,
        id: null,
        updatedAt: null,
        updatedById: null,
      },
    };
  }

  return {
    data: {
      configured: true,
      id: config.id,
      pickupFeeCommissionPercent: Number(config.pickupFeeCommissionPercent),
      isActive: config.isActive,
      updatedAt: config.updatedAt,
      updatedById: config.updatedById,
    },
  };
});

/**
 * POST - Salva a configuração de comissões
 */
export const POST = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);

  const body = await req.json();
  const parsed = commissionConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { pickupFeeCommissionPercent, isActive } = parsed.data;

  // Buscar configuração existente
  const existingConfig = await prisma.platformCommission.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  let config;

  if (existingConfig) {
    // Atualizar configuração existente
    config = await prisma.platformCommission.update({
      where: { id: existingConfig.id },
      data: {
        pickupFeeCommissionPercent,
        isActive,
        updatedById: session.staffId,
      },
    });
  } else {
    // Criar nova configuração
    config = await prisma.platformCommission.create({
      data: {
        pickupFeeCommissionPercent,
        isActive,
        updatedById: session.staffId,
      },
    });
  }

  // Invalidar cache se houver
  try {
    const { invalidatePlatformCommissionCache } = await import('@/modules/quotes/application/commission');
    invalidatePlatformCommissionCache();
  } catch {
    // Cache não implementado ainda ou módulo não existe
  }

  return {
    data: {
      success: true,
      message: 'Configuração de comissões salva com sucesso',
      id: config.id,
      pickupFeeCommissionPercent: Number(config.pickupFeeCommissionPercent),
      isActive: config.isActive,
    },
  };
});
