/**
 * GET /api/admin/knowledge-base/[id]
 * PUT /api/admin/knowledge-base/[id]
 * DELETE /api/admin/knowledge-base/[id]
 *
 * CRUD de artigo individual da base de conhecimento.
 */

import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';

// ============================================================================
// Validation Schema
// ============================================================================

const updateArticleSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').optional(),
  title: z.string().min(3).max(200).optional(),
  contentMarkdown: z.string().min(10).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

// ============================================================================
// Types
// ============================================================================

interface ArticleResponse {
  id: string;
  slug: string;
  title: string;
  contentMarkdown: string;
  category: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// GET - Detalhes do artigo
// ============================================================================

export const GET = withApiHandler<ArticleResponse, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const articleId = params.id;

  // Buscar por ID ou slug
  const article = await prisma.knowledgeBaseArticle.findFirst({
    where: {
      OR: [
        { id: articleId },
        { slug: articleId },
      ],
    },
  });

  if (!article) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Artigo não encontrado', status: 404 });
  }

  return {
    data: {
      ...article,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    },
  };
});

// ============================================================================
// PUT - Atualiza artigo
// ============================================================================

export const PUT = withApiHandler<ArticleResponse, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const articleId = params.id;

  // Verificar se artigo existe
  const existing = await prisma.knowledgeBaseArticle.findUnique({
    where: { id: articleId },
  });

  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Artigo não encontrado', status: 404 });
  }

  const body = await req.json();
  const parsed = updateArticleSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  // Se está alterando slug, verificar se não existe outro com mesmo slug
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await prisma.knowledgeBaseArticle.findFirst({
      where: {
        slug: data.slug,
        id: { not: articleId },
      },
    });

    if (slugExists) {
      throw new ApiError({
        code: 'DUPLICATE_SLUG',
        message: 'Já existe um artigo com este slug',
        status: 400,
      });
    }
  }

  const article = await prisma.knowledgeBaseArticle.update({
    where: { id: articleId },
    data: {
      ...(data.slug && { slug: data.slug }),
      ...(data.title && { title: data.title }),
      ...(data.contentMarkdown && { contentMarkdown: data.contentMarkdown }),
      ...(data.tags && { tags: data.tags }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
    },
  });

  return {
    data: {
      ...article,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    },
  };
});

// ============================================================================
// DELETE - Remove artigo
// ============================================================================

export const DELETE = withApiHandler<DeleteResponse, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof Response) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const articleId = params.id;

  // Verificar se artigo existe
  const existing = await prisma.knowledgeBaseArticle.findUnique({
    where: { id: articleId },
  });

  if (!existing) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Artigo não encontrado', status: 404 });
  }

  await prisma.knowledgeBaseArticle.delete({
    where: { id: articleId },
  });

  return {
    data: {
      success: true,
      message: 'Artigo removido com sucesso',
    },
  };
});
