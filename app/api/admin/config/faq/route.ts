/**
 * GET /api/admin/config/faq - Lista todas as FAQs (incluindo inativas)
 * POST /api/admin/config/faq - Cria nova FAQ
 *
 * Rotas de administração de FAQ (Admin)
 */

import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import type { FAQAudience } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { faqCache } from '@/platform/cache/cache';

/**
 * Schema de validação para criar/editar FAQ
 */
const faqItemSchema = z.object({
  question: z.string().min(10, 'Pergunta deve ter no mínimo 10 caracteres').max(500),
  answer: z.string().min(20, 'Resposta deve ter no mínimo 20 caracteres').max(5000),
  category: z.string().max(100).nullable().optional(),
  audience: z.enum(['USER', 'COLLECTOR']).default('USER'),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

/**
 * GET - Lista todas as FAQs para administração
 */
export const GET = withApiHandler(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { searchParams } = new URL(req.url);
  const audienceParam = searchParams.get('audience');
  const showInactive = searchParams.get('showInactive') === 'true';

  // Montar filtros
  const where: {
    audience?: FAQAudience;
    isActive?: boolean;
  } = {};

  if (audienceParam === 'USER' || audienceParam === 'COLLECTOR') {
    where.audience = audienceParam;
  }

  if (!showInactive) {
    where.isActive = true;
  }

  const faqs = await prisma.fAQItem.findMany({
    where,
    orderBy: [
      { audience: 'asc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Estatísticas
  const stats = await prisma.fAQItem.aggregate({
    _count: { id: true },
    _sum: { views: true, helpfulYes: true, helpfulNo: true },
  });

  return {
    data: {
      items: faqs.map((faq) => ({
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      })),
      total: faqs.length,
      stats: {
        totalItems: stats._count.id,
        totalViews: stats._sum.views || 0,
        totalHelpfulYes: stats._sum.helpfulYes || 0,
        totalHelpfulNo: stats._sum.helpfulNo || 0,
      },
    },
  };
});

/**
 * POST - Cria nova FAQ
 */
export const POST = withApiHandler(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const body = await req.json();
  const parsed = faqItemSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { question, answer, category, audience, sortOrder, isActive } = parsed.data;

  // Criar FAQ
  const faq = await prisma.fAQItem.create({
    data: {
      question,
      answer,
      category: category || null,
      audience,
      sortOrder,
      isActive,
      createdBy: authResult.user.id,
    },
  });

  // Invalidar cache de FAQ público (fire and forget)
  faqCache.invalidateAll().catch(() => {});

  return {
    data: {
      success: true,
      message: 'FAQ criada com sucesso',
      item: {
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    },
  };
});
