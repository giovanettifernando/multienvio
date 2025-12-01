/**
 * GET /api/admin/config/faq/[id] - Busca FAQ por ID
 * PATCH /api/admin/config/faq/[id] - Atualiza FAQ
 * DELETE /api/admin/config/faq/[id] - Remove FAQ
 *
 * Rotas de administração de FAQ individual (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const faq = await prisma.fAQItem.findUnique({
      where: { id },
    });

    if (!faq) {
      return NextResponse.json({ error: 'FAQ não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[ADMIN_FAQ_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Erro ao buscar FAQ' }, { status: 500 });
  }
}

/**
 * PATCH - Atualiza FAQ existente
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // Verificar se FAQ existe
    const existing = await prisma.fAQItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'FAQ não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateFaqSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Atualizar FAQ
    const faq = await prisma.fAQItem.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: 'FAQ atualizada com sucesso',
      item: {
        ...faq,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[ADMIN_FAQ_PATCH]', error);
    return NextResponse.json({ error: 'Erro ao atualizar FAQ' }, { status: 500 });
  }
}

/**
 * DELETE - Remove FAQ (soft delete ou hard delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // Verificar se FAQ existe
    const existing = await prisma.fAQItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'FAQ não encontrada' }, { status: 404 });
    }

    // Hard delete - remover do banco
    await prisma.fAQItem.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'FAQ removida com sucesso',
    });
  } catch (error) {
    console.error('[ADMIN_FAQ_DELETE]', error);
    return NextResponse.json({ error: 'Erro ao remover FAQ' }, { status: 500 });
  }
}
