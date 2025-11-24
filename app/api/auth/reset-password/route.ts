import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { ResetPasswordSchema } from '@/lib/validation/auth';
import prisma from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = ResetPasswordSchema.parse(payload);

    console.log('[RESET_PASSWORD] Attempting to reset password');

    // Hash the token to compare with database
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

    // Find reset token record
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            tokenVersion: true,
          },
        },
      },
    });

    if (!resetToken) {
      console.log('[RESET_PASSWORD] Invalid token');
      return NextResponse.json(
        { message: 'Token de redefinição inválido ou expirado' },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (resetToken.usedAt) {
      console.log('[RESET_PASSWORD] Token already used');
      return NextResponse.json(
        { message: 'Este link já foi utilizado. Solicite um novo link.' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      console.log('[RESET_PASSWORD] Token expired');
      return NextResponse.json(
        { message: 'Token de redefinição expirado. Solicite um novo link.' },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt (12 salt rounds for consistency with password change)
    const passwordHash = await bcrypt.hash(data.password, 12);
    console.log('[RESET_PASSWORD] Generated hash:', passwordHash.substring(0, 20) + '...');
    console.log('[RESET_PASSWORD] Hash length:', passwordHash.length);

    const now = new Date();

    // Update user's password, increment tokenVersion, and mark token as used
    const result = await prisma.$transaction([
      // Update user password and invalidate all sessions
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordUpdatedAt: now,
          tokenVersion: resetToken.user.tokenVersion + 1, // Invalidate all existing sessions
          updatedAt: now,
        },
      }),
      // Mark token as used
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          usedAt: now,
        },
      }),
    ]);

    console.log('[RESET_PASSWORD] Transaction completed successfully');
    console.log('[RESET_PASSWORD] Updated user ID:', result[0].id);
    console.log('[RESET_PASSWORD] New tokenVersion:', result[0].tokenVersion);

    // Verify the update was persisted
    const verifyUser = await prisma.user.findUnique({
      where: { id: resetToken.userId },
      select: {
        passwordHash: true,
        tokenVersion: true,
        passwordUpdatedAt: true
      },
    });

    console.log('[RESET_PASSWORD] Verified passwordHash in DB:', verifyUser?.passwordHash?.substring(0, 20) + '...');
    console.log('[RESET_PASSWORD] Verified tokenVersion:', verifyUser?.tokenVersion);
    console.log('[RESET_PASSWORD] Verified passwordUpdatedAt:', verifyUser?.passwordUpdatedAt);
    console.log('[RESET_PASSWORD] Password reset successfully for user:', resetToken.user.email);

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
