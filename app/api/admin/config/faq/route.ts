/**
 * GET /api/admin/config/faq - Lista todas as FAQs (incluindo inativas)
 * POST /api/admin/config/faq - Cria nova FAQ
 *
 * Rotas de administração de FAQ (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import type { FAQAudience } from '@prisma/client';

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
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('[ADMIN_FAQ_GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar FAQs' }, { status: 500 });
  }
}

/**
 * POST - Cria nova FAQ
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = faqItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      message: 'FAQ criada com sucesso',
      item: {
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[ADMIN_FAQ_POST]', error);
    return NextResponse.json({ error: 'Erro ao criar FAQ' }, { status: 500 });
  }
}
