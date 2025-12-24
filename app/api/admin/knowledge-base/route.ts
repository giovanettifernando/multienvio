/**
 * GET /api/admin/knowledge-base
 * POST /api/admin/knowledge-base
 *
 * CRUD de artigos da base de conhecimento para o assistente IA.
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';

// ============================================================================
// Validation Schema
// ============================================================================

const articleSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(200),
  contentMarkdown: z.string().min(10, 'Conteúdo deve ter no mínimo 10 caracteres'),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional().nullable(),
  isPublished: z.boolean().optional().default(false),
});

// ============================================================================
// Types
// ============================================================================

interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ArticleListResponse {
  articles: ArticleListItem[];
  total: number;
}

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

// ============================================================================
// GET - Lista artigos
// ============================================================================

export const GET = withApiHandler<ArticleListResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);
  

  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const published = url.searchParams.get('published');
  const search = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const where: any = {};

  if (category) {
    where.category = category;
  }

  if (published !== null) {
    where.isPublished = published === 'true';
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { contentMarkdown: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  const [articles, total] = await Promise.all([
    prisma.knowledgeBaseArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        tags: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.knowledgeBaseArticle.count({ where }),
  ]);

  const items: ArticleListItem[] = articles.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return { data: { articles: items, total } };
});

// ============================================================================
// POST - Cria artigo
// ============================================================================

export const POST = withApiHandler<ArticleResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);
  

  const body = await req.json();
  const parsed = articleSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  // Verificar slug único
  const existing = await prisma.knowledgeBaseArticle.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new ApiError({
      code: 'DUPLICATE_SLUG',
      message: 'Já existe um artigo com este slug',
      status: 400,
    });
  }

  const article = await prisma.knowledgeBaseArticle.create({
    data: {
      slug: data.slug,
      title: data.title,
      contentMarkdown: data.contentMarkdown,
      tags: data.tags,
      category: data.category,
      isPublished: data.isPublished,
    },
  });

  return {
    data: {
      ...article,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    },
    status: 201,
  };
});
