/**
 * GET /api/faq
 *
 * Lista pública de FAQs ativos para a Central de Ajuda
 * Não requer autenticação
 *
 * CACHE: 1 hora (LONG TTL) - FAQs mudam raramente
 */

import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { configCache, CacheTTL } from '@/lib/cache';
import type { FAQAudience } from '@prisma/client';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
};

type GetFAQResponse = {
  items: FAQItem[];
  total: number;
  categories: string[];
};

export const GET = withApiHandler<GetFAQResponse>(async (context) => {
  const { searchParams } = new URL(context.req.url);
  const audienceParam = searchParams.get('audience') || 'USER';
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category');

  // Validar audience
  const validAudiences: FAQAudience[] = ['USER', 'COLLECTOR'];
  const audience: FAQAudience = validAudiences.includes(audienceParam as FAQAudience)
    ? (audienceParam as FAQAudience)
    : 'USER';

  // Gerar cache key - só cacheia listagem sem busca (query vazia)
  // Buscas específicas não são cacheadas pois são únicas
  const shouldCache = !query;
  const cacheKey = shouldCache
    ? `faq:${audience}:${category || 'all'}`
    : null;

  // Verificar cache se aplicável
  if (cacheKey) {
    const cached = await configCache.get<GetFAQResponse>(cacheKey);
    if (cached) {
      return { data: cached };
    }
  }

  // Buscar FAQs ativos ordenados
  const faqs = await prisma.fAQItem.findMany({
    where: {
      isActive: true,
      audience,
      ...(category && { category }),
      ...(query && {
        OR: [
          { question: { contains: query, mode: 'insensitive' } },
          { answer: { contains: query, mode: 'insensitive' } },
        ],
      }),
    },
    select: {
      id: true,
      question: true,
      answer: true,
      category: true,
      views: true,
      helpfulYes: true,
      helpfulNo: true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Buscar categorias únicas para filtro
  const categories = await prisma.fAQItem.findMany({
    where: {
      isActive: true,
      audience,
      category: { not: null },
    },
    select: {
      category: true,
    },
    distinct: ['category'],
  });

  const uniqueCategories = categories
    .map((c) => c.category)
    .filter((c): c is string => c !== null);

  const response: GetFAQResponse = {
    items: faqs,
    total: faqs.length,
    categories: uniqueCategories,
  };

  // Salvar no cache se aplicável (TTL 1 hora)
  if (cacheKey) {
    configCache.set(cacheKey, response).catch(() => {});
  }

  return { data: response };
});
