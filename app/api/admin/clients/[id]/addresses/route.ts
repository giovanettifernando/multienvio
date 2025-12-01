/**
 * GET/POST /api/admin/clients/[id]/addresses
 *
 * Gerencia endereços de um usuário da plataforma (Admin)
 */


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const addressSchema = z.object({
  label: z.string().optional(),
  cep: z.string().min(8).max(8),
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
  isDefault: z.boolean().optional(),
});

// GET - Listar endereços
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('[ADMIN_GET_ADDRESSES]', error);
    return NextResponse.json({ message: 'Erro ao buscar endereços' }, { status: 500 });
  }
}

// POST - Criar novo endereço
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;
    const body = await request.json();

    const validation = addressSchema.safeParse(body);
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
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        label: data.label,
        cep: data.cep.replace(/\D/g, ''),
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf.toUpperCase(),
        isDefault: data.isDefault ?? false,
      },
    });

    console.log('[ADMIN_CREATE_ADDRESS]', {
      adminId: authResult.user.id,
      userId,
      addressId: address.id,
    });

    return NextResponse.json({ message: 'Endereço criado com sucesso', address }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_CREATE_ADDRESS_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao criar endereço' }, { status: 500 });
  }
}
