/**
 * PUT/DELETE /api/admin/clients/[id]/addresses/[addressId]
 *
 * Atualiza ou remove endereço de um usuário (Admin)
 */


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string; addressId: string }>;
}

const addressSchema = z.object({
  label: z.string().optional(),
  cep: z.string().min(8).max(8).optional(),
  logradouro: z.string().min(1).optional(),
  numero: z.string().min(1).optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1).optional(),
  cidade: z.string().min(1).optional(),
  uf: z.string().length(2).optional(),
  isDefault: z.boolean().optional(),
});

// PUT - Atualizar endereço
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, addressId } = await context.params;
    const body = await request.json();

    const validation = addressSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se endereço existe e pertence ao usuário
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Endereço não encontrado' }, { status: 404 });
    }

    const data = validation.data;

    // Se for default, remover default de outros
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id: addressId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.cep && { cep: data.cep.replace(/\D/g, '') }),
        ...(data.logradouro && { logradouro: data.logradouro }),
        ...(data.numero && { numero: data.numero }),
        ...(data.complemento !== undefined && { complemento: data.complemento }),
        ...(data.bairro && { bairro: data.bairro }),
        ...(data.cidade && { cidade: data.cidade }),
        ...(data.uf && { uf: data.uf.toUpperCase() }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    console.log('[ADMIN_UPDATE_ADDRESS]', {
      adminId: authResult.user.id,
      userId,
      addressId,
    });

    return NextResponse.json({ message: 'Endereço atualizado com sucesso', address });
  } catch (error) {
    console.error('[ADMIN_UPDATE_ADDRESS_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao atualizar endereço' }, { status: 500 });
  }
}

// DELETE - Remover endereço
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, addressId } = await context.params;

    // Verificar se endereço existe e pertence ao usuário
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Endereço não encontrado' }, { status: 404 });
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    console.log('[ADMIN_DELETE_ADDRESS]', {
      adminId: authResult.user.id,
      userId,
      addressId,
    });

    return NextResponse.json({ message: 'Endereço removido com sucesso' });
  } catch (error) {
    console.error('[ADMIN_DELETE_ADDRESS_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao remover endereço' }, { status: 500 });
  }
}
