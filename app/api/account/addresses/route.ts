/**
 * GET /api/account/addresses - Lista endereços do usuário
 * POST /api/account/addresses - Cria novo endereço
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';


/**
 * GET /api/account/addresses
 * Lista todos os endereços do usuário autenticado
 */
export async function GET(request: NextRequest) {
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

    // Buscar endereços do usuário ordenados por: default primeiro, depois por data de criação
    const addresses = await prisma.address.findMany({
      where: { userId: currentUser.userId },
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
      orderBy: [
        { isDefault: 'desc' }, // Default primeiro
        { createdAt: 'desc' },  // Mais recente depois
      ],
    });

    return NextResponse.json({
      success: true,
      addresses,
    });
  } catch (error) {
    console.error('[GET /api/account/addresses] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao buscar endereços',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/addresses
 * Cria um novo endereço para o usuário autenticado
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Importação dinâmica do schema
    const { AddressSchema } = await import('@/lib/validation/address');

    // Validar dados
    const validated = AddressSchema.parse(body);

    console.log('[POST /api/account/addresses] Creating address:', currentUser.userId, validated);

    // Se isDefault=true, desmarcar todos os outros endereços como default
    if (validated.isDefault) {
      await prisma.address.updateMany({
        where: { userId: currentUser.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Criar endereço
    const address = await prisma.address.create({
      data: {
        userId: currentUser.userId,
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

    console.log('[POST /api/account/addresses] Address created:', address.id);

    return NextResponse.json({
      success: true,
      message: 'Endereço criado com sucesso',
      address,
    }, { status: 201 });
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

    console.error('[POST /api/account/addresses] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao criar endereço',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
