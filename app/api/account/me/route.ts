import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/session';


/**
 * GET /api/account/me
 * Retorna os dados do usuário autenticado
 */
export async function GET(request: Request) {
  try {
    // Obter usuário do token JWT
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

    // Buscar dados completos do usuário
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        avatarUrl: true,
        hasCompany: true,
        cnpj: true,
        razaoSocial: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('[GET /api/account/me] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao buscar dados do usuário',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/account/me
 * Atualiza os dados do usuário autenticado
 */
export async function PUT(request: Request) {
  try {
    // Obter usuário do token JWT
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

    // Rejeitar tentativa de alterar email
    if ('email' in body) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email não pode ser alterado',
          code: 'EMAIL_IMMUTABLE',
          errors: [{ field: 'email', message: 'Email não pode ser alterado' }],
        },
        { status: 400 }
      );
    }

    // Importação dinâmica do schema para evitar erros de bundling
    const { UpdateProfileSchema } = await import('@/lib/validation/profile');

    // Validar dados com Zod
    const validated = UpdateProfileSchema.parse(body);

    console.log('[PUT /api/account/me] Updating user:', currentUser.userId, validated);

    // Atualizar usuário
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        name: validated.name,
        phone: validated.phone,
        cpf: validated.cpf,
        avatarUrl: validated.avatarUrl,
        hasCompany: validated.hasCompany,
        cnpj: validated.cnpj,
        razaoSocial: validated.razaoSocial,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        avatarUrl: true,
        hasCompany: true,
        cnpj: true,
        razaoSocial: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('[PUT /api/account/me] User updated successfully:', currentUser.userId);

    return NextResponse.json({
      success: true,
      message: 'Dados atualizados com sucesso',
      user: updatedUser,
    });
  } catch (error: unknown) {
    // Erro de validação Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> };

      console.log('[PUT /api/account/me] Validation error:', zodError.issues);

      // Mapear erros específicos
      const firstError = zodError.issues[0];
      const field = firstError.path.join('.');
      const message = firstError.message;

      let code = 'VALIDATION_ERROR';
      if (field === 'name') code = 'INVALID_NAME';
      if (field === 'phone') code = 'INVALID_PHONE';
      if (field === 'cpf') code = 'INVALID_CPF';
      if (field === 'email') code = 'EMAIL_IMMUTABLE';

      return NextResponse.json(
        {
          success: false,
          message,
          code,
          errors: zodError.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('[PUT /api/account/me] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao atualizar dados do usuário',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
