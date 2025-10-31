import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashToken } from '@/lib/auth/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Token de verificação não fornecido',
          code: 'MISSING_TOKEN',
        },
        { status: 400 }
      );
    }

    console.log('[VERIFY_EMAIL] Attempting to verify email with token');

    // Hash the token to compare with database
    const hashedToken = hashToken(token);

    // Check if user with this token exists and is already verified
    const existingUser = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
      },
    });

    if (existingUser && existingUser.emailVerified) {
      console.log('[VERIFY_EMAIL] User already verified:', existingUser.email);
      return NextResponse.json({
        success: true,
        message: 'Este email já foi verificado anteriormente. Você pode fazer login.',
        code: 'ALREADY_VERIFIED',
      });
    }

    // Find user with matching verification token and not verified
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
        emailVerified: false,
      },
    });

    if (!user) {
      console.log('[VERIFY_EMAIL] Invalid or expired token');
      return NextResponse.json(
        {
          success: false,
          message: 'Token de verificação inválido ou expirado. Solicite um novo email de verificação.',
          code: 'INVALID_TOKEN',
        },
        { status: 400 }
      );
    }

    // Update user to mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null, // Clear the token
        status: 'active', // Activate the account
      },
    });

    console.log('[VERIFY_EMAIL] Email verified successfully for user:', user.email);

    return NextResponse.json({
      success: true,
      message: 'Email verificado com sucesso! Você já pode fazer login.',
      code: 'SUCCESS',
      email: user.email,
    });
  } catch (error) {
    console.error('[VERIFY_EMAIL] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Erro ao verificar email' },
      { status: 500 }
    );
  }
}
