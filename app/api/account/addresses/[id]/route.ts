/**
 * PUT /api/account/addresses/[id] - Atualiza endereço
 * DELETE /api/account/addresses/[id] - Deleta endereço
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';


/**
 * PUT /api/account/addresses/[id]
 * Atualiza um endereço específico
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Não autenticado',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Verificar se o endereço pertence ao usuário
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId: currentUser.userId },
    });

    if (!existingAddress) {
      return NextResponse.json(
        {
          success: false,
          message: 'Endereço não encontrado',
          code: 'ADDRESS_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Importação dinâmica do schema
    const { AddressSchema } = await import('@/lib/validation/address');

    // Validar dados
    const validated = AddressSchema.parse(body);

    console.log('[PUT /api/account/addresses/[id]] Updating address:', id, validated);

    // Se isDefault=true, desmarcar todos os outros endereços como default
    if (validated.isDefault) {
      await prisma.address.updateMany({
        where: { 
          userId: currentUser.userId, 
          isDefault: true,
          id: { not: id } // Exceto o que está sendo atualizado
        },
        data: { isDefault: false },
      });
    }

    // Atualizar endereço
    const address = await prisma.address.update({
      where: { id },
      data: {
        label: validated.label,
        cep: validated.cep,
        logradouro: validated.logradouro,
        numero: validated.numero,
        complemento: validated.complemento,
        bairro: validated.bairro,
        cidade: validated.cidade,
        uf: validated.uf,
        isDefault: validated.isDefault,
      },
      select: {
        id: true,
        label: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        uf: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('[PUT /api/account/addresses/[id]] Address updated:', address.id);

    return NextResponse.json({
      success: true,
      message: 'Endereço atualizado com sucesso',
      address,
    });
  } catch (error: unknown) {
    // Erro de validação Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> };
      return NextResponse.json(
        {
          success: false,
          message: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          errors: zodError.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('[PUT /api/account/addresses/[id]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao atualizar endereço',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account/addresses/[id]
 * Deleta um endereço específico
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Não autenticado',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar se o endereço pertence ao usuário
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId: currentUser.userId },
    });

    if (!existingAddress) {
      return NextResponse.json(
        {
          success: false,
          message: 'Endereço não encontrado',
          code: 'ADDRESS_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    console.log('[DELETE /api/account/addresses/[id]] Deleting address:', id);

    // Deletar endereço
    await prisma.address.delete({
      where: { id },
    });

    console.log('[DELETE /api/account/addresses/[id]] Address deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Endereço removido com sucesso',
    });
  } catch (error) {
    console.error('[DELETE /api/account/addresses/[id]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao remover endereço',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
