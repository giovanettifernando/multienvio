/**
 * PUT/DELETE /api/admin/clients/[id]/recipients/[recipientId]
 *
 * Atualiza ou remove destinatário de um usuário (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string; recipientId: string }>;
}

const recipientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  document: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  cep: z.string().min(8).max(8).optional(),
  logradouro: z.string().min(1).optional(),
  numero: z.string().min(1).optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1).optional(),
  cidade: z.string().min(1).optional(),
  uf: z.string().length(2).optional(),
});

// PUT - Atualizar destinatário
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, recipientId } = await context.params;
    const body = await request.json();

    const validation = recipientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se destinatário existe e pertence ao usuário
    const existing = await prisma.recipient.findFirst({
      where: { id: recipientId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Destinatário não encontrado' }, { status: 404 });
    }

    const data = validation.data;

    // Se for default, remover default de outros
    if (data.isDefault) {
      await prisma.recipient.updateMany({
        where: { userId, isDefault: true, id: { not: recipientId } },
        data: { isDefault: false },
      });
    }

    const recipient = await prisma.recipient.update({
      where: { id: recipientId },
      data: {
        ...(data.name && { name: data.name, nameSearch: data.name.toLowerCase() }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.document !== undefined && {
          document: data.document?.replace(/\D/g, '') || null,
        }),
        ...(data.phone !== undefined && { phone: data.phone?.replace(/\D/g, '') || null }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.cep && { cep: data.cep.replace(/\D/g, '') }),
        ...(data.logradouro && { logradouro: data.logradouro }),
        ...(data.numero && { numero: data.numero }),
        ...(data.complemento !== undefined && { complemento: data.complemento }),
        ...(data.bairro && { bairro: data.bairro }),
        ...(data.cidade && { cidade: data.cidade }),
        ...(data.uf && { uf: data.uf.toUpperCase() }),
      },
    });

    console.log('[ADMIN_UPDATE_RECIPIENT]', {
      adminId: authResult.user.id,
      userId,
      recipientId,
    });

    return NextResponse.json({ message: 'Destinatário atualizado com sucesso', recipient });
  } catch (error) {
    console.error('[ADMIN_UPDATE_RECIPIENT_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao atualizar destinatário' }, { status: 500 });
  }
}

// DELETE - Remover destinatário
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, recipientId } = await context.params;

    // Verificar se destinatário existe e pertence ao usuário
    const existing = await prisma.recipient.findFirst({
      where: { id: recipientId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Destinatário não encontrado' }, { status: 404 });
    }

    await prisma.recipient.delete({
      where: { id: recipientId },
    });

    console.log('[ADMIN_DELETE_RECIPIENT]', {
      adminId: authResult.user.id,
      userId,
      recipientId,
    });

    return NextResponse.json({ message: 'Destinatário removido com sucesso' });
  } catch (error) {
    console.error('[ADMIN_DELETE_RECIPIENT_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao remover destinatário' }, { status: 500 });
  }
}
