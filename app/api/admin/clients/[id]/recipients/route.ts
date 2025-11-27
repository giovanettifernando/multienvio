/**
 * GET/POST /api/admin/clients/[id]/recipients
 *
 * Gerencia destinatários recorrentes de um usuário (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const recipientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().nullable().optional(),
  document: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  cep: z.string().min(8).max(8),
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
});

// GET - Listar destinatários
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;

    const recipients = await prisma.recipient.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('[ADMIN_GET_RECIPIENTS]', error);
    return NextResponse.json({ message: 'Erro ao buscar destinatários' }, { status: 500 });
  }
}

// POST - Criar novo destinatário
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;
    const body = await request.json();

    const validation = recipientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    const data = validation.data;

    // Se for default, remover default de outros
    if (data.isDefault) {
      await prisma.recipient.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const recipient = await prisma.recipient.create({
      data: {
        userId,
        name: data.name,
        nameSearch: data.name.toLowerCase(),
        email: data.email,
        document: data.document?.replace(/\D/g, '') || null,
        phone: data.phone?.replace(/\D/g, '') || null,
        notes: data.notes,
        isDefault: data.isDefault ?? false,
        cep: data.cep.replace(/\D/g, ''),
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf.toUpperCase(),
      },
    });

    console.log('[ADMIN_CREATE_RECIPIENT]', {
      adminId: authResult.user.id,
      userId,
      recipientId: recipient.id,
    });

    return NextResponse.json(
      { message: 'Destinatário criado com sucesso', recipient },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ADMIN_CREATE_RECIPIENT_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao criar destinatário' }, { status: 500 });
  }
}
