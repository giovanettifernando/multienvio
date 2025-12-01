/**
 * POST /api/faq/[id]/feedback
 *
 * Registra feedback de utilidade da FAQ ("Foi útil?" - Sim/Não)
 * ou incrementa contador de visualizações
 * Não requer autenticação
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const feedbackSchema = z.object({
  helpful: z.boolean().optional(),
  view: z.boolean().optional(),
}).refine(data => data.helpful !== undefined || data.view !== undefined, {
  message: 'Informe helpful ou view',
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { helpful, view } = parsed.data;

    // Verificar se FAQ existe e está ativo
    const faq = await prisma.fAQItem.findFirst({
      where: { id, isActive: true },
    });

    if (!faq) {
      return NextResponse.json({ error: 'FAQ não encontrada' }, { status: 404 });
    }

    // Determinar o que atualizar
    const updateData: { views?: { increment: number }; helpfulYes?: { increment: number }; helpfulNo?: { increment: number } } = {};

    if (view) {
      updateData.views = { increment: 1 };
    } else if (helpful !== undefined) {
      if (helpful) {
        updateData.helpfulYes = { increment: 1 };
      } else {
        updateData.helpfulNo = { increment: 1 };
      }
    }

    await prisma.fAQItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: view ? 'Visualização registrada' : 'Obrigado pelo feedback!',
    });
  } catch (error) {
    console.error('[FAQ_FEEDBACK]', error);
    return NextResponse.json({ error: 'Erro ao registrar feedback' }, { status: 500 });
  }
}
