/**
 * GET /api/admin/config/comissoes
 * POST /api/admin/config/comissoes
 *
 * Rotas de configuração das comissões da plataforma (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

/**
 * Schema de validação para configuração de comissões
 */
const commissionConfigSchema = z.object({
  shippingCommissionPercent: z
    .number()
    .min(0, 'Comissão não pode ser negativa')
    .max(100, 'Comissão não pode exceder 100%'),
  pickupFeeCommissionPercent: z
    .number()
    .min(0, 'Comissão não pode ser negativa')
    .max(100, 'Comissão não pode exceder 100%'),
  isActive: z.boolean().default(true),
});

/**
 * GET - Retorna a configuração atual de comissões
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Buscar configuração ativa (singleton - pega a mais recente)
    const config = await prisma.platformCommission.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      // Retornar valores padrão se não houver configuração
      return NextResponse.json({
        configured: false,
        shippingCommissionPercent: 0,
        pickupFeeCommissionPercent: 0,
        isActive: true,
      });
    }

    return NextResponse.json({
      configured: true,
      id: config.id,
      shippingCommissionPercent: Number(config.shippingCommissionPercent),
      pickupFeeCommissionPercent: Number(config.pickupFeeCommissionPercent),
      isActive: config.isActive,
      updatedAt: config.updatedAt,
      updatedById: config.updatedById,
    });
  } catch (error) {
    console.error('[ADMIN_COMISSOES_GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar configuração' }, { status: 500 });
  }
}

/**
 * POST - Salva a configuração de comissões
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = commissionConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { shippingCommissionPercent, pickupFeeCommissionPercent, isActive } = parsed.data;

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
          shippingCommissionPercent,
          pickupFeeCommissionPercent,
          isActive,
          updatedById: authResult.user.id,
        },
      });
    } else {
      // Criar nova configuração
      config = await prisma.platformCommission.create({
        data: {
          shippingCommissionPercent,
          pickupFeeCommissionPercent,
          isActive,
          updatedById: authResult.user.id,
        },
      });
    }

    // Invalidar cache se houver
    try {
      const { invalidatePlatformCommissionCache } = await import('@/lib/quotes/commission');
      invalidatePlatformCommissionCache();
    } catch {
      // Cache não implementado ainda ou módulo não existe
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração de comissões salva com sucesso',
      id: config.id,
      shippingCommissionPercent: Number(config.shippingCommissionPercent),
      pickupFeeCommissionPercent: Number(config.pickupFeeCommissionPercent),
      isActive: config.isActive,
    });
  } catch (error) {
    console.error('[ADMIN_COMISSOES_POST]', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}
