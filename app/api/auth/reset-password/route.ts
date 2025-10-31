import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { ResetPasswordSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { hashToken, isTokenExpired } from '@/lib/auth/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = ResetPasswordSchema.parse(payload);

    console.log('[RESET_PASSWORD] Attempting to reset password');

    // Hash the token to compare with database
    const hashedToken = hashToken(data.token);

    // Find user with matching reset token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
      },
    });

    if (!user) {
      console.log('[RESET_PASSWORD] Invalid token');
      return NextResponse.json(
        { message: 'Token de redefinição inválido ou expirado' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (isTokenExpired(user.resetPasswordExpiry)) {
      console.log('[RESET_PASSWORD] Token expired for user:', user.email);
      return NextResponse.json(
        { message: 'Token de redefinição expirado. Solicite um novo link.' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Update user's password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    console.log('[RESET_PASSWORD] Password reset successfully for user:', user.email);

    return NextResponse.json({
      message: 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.',
      success: true,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('[RESET_PASSWORD] Validation error:', error.issues);
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    console.error('[RESET_PASSWORD] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Erro ao redefinir senha' },
      { status: 500 }
    );
  }
}
