/**
 * POST /api/faq/[id]/feedback
 *
 * Registra feedback de utilidade da FAQ ("Foi útil?" - Sim/Não)
 * ou incrementa contador de visualizações
 * Não requer autenticação
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { z } from 'zod';

const feedbackSchema = z.object({
  helpful: z.boolean().optional(),
  view: z.boolean().optional(),
}).refine(data => data.helpful !== undefined || data.view !== undefined, {
  message: 'Informe helpful ou view',
});

type FAQFeedbackResponse = {
  success: boolean;
  message: string;
};

export const POST = withApiHandler<FAQFeedbackResponse, { id: string }>(async ({ req, params }) => {
  const { id } = params;

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten()
    });
  }

  const { helpful, view } = parsed.data;

  // Verificar se FAQ existe e está ativo
  const faq = await prisma.fAQItem.findFirst({
    where: { id, isActive: true },
  });

  if (!faq) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'FAQ não encontrada',
      status: 404
    });
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

  return {
    data: {
      success: true,
      message: view ? 'Visualização registrada' : 'Obrigado pelo feedback!',
    }
  };
});
