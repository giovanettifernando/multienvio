/**
 * GET /api/admin/config/faq/[id] - Busca FAQ por ID
 * PATCH /api/admin/config/faq/[id] - Atualiza FAQ
 * DELETE /api/admin/config/faq/[id] - Remove FAQ
 *
 * Rotas de administração de FAQ individual (Admin)
 */

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

/**
 * Schema de validação para atualizar FAQ (campos opcionais)
 */
const updateFaqSchema = z.object({
  question: z.string().min(10, 'Pergunta deve ter no mínimo 10 caracteres').max(500).optional(),
  answer: z.string().min(20, 'Resposta deve ter no mínimo 20 caracteres').max(5000).optional(),
  category: z.string().max(100).nullable().optional(),
  audience: z.enum(['USER', 'COLLECTOR']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET - Busca FAQ específica por ID
 */
export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id } = params;

  const faq = await prisma.fAQItem.findUnique({
    where: { id },
  });

  if (!faq) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'FAQ não encontrada',
      status: 404,
    });
  }

  return {
    data: {
      item: {
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * PATCH - Atualiza FAQ existente
 */
export const PATCH = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id } = params;

  // Verificar se FAQ existe
  const existing = await prisma.fAQItem.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'FAQ não encontrada',
      status: 404,
    });
  }

  const body = await req.json();
  const parsed = updateFaqSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  // Atualizar FAQ
  const faq = await prisma.fAQItem.update({
    where: { id },
    data: parsed.data,
  });

  return {
    data: {
      success: true,
      message: 'FAQ atualizada com sucesso',
      item: {
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    },
  };
});

/**
 * DELETE - Remove FAQ (soft delete ou hard delete)
 */
export const DELETE = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id } = params;

  // Verificar se FAQ existe
  const existing = await prisma.fAQItem.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'FAQ não encontrada',
      status: 404,
    });
  }

  // Hard delete - remover do banco
  await prisma.fAQItem.delete({
    where: { id },
  });

  return {
    data: {
      success: true,
      message: 'FAQ removida com sucesso',
    },
  };
});
