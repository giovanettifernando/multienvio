import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForgotPasswordSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { generateTokenWithExpiry } from '@/lib/auth/tokens';
import { sendPasswordResetEmail } from '@/lib/email/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = ForgotPasswordSchema.parse(payload);

    console.log('[FORGOT_PASSWORD] Password reset requested for:', data.email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      console.log('[FORGOT_PASSWORD] User not found, but returning success');
      return NextResponse.json({
        message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
      });
    }

    // Generate reset token with 1 hour expiry
    const { token, hashedToken, expiry } = generateTokenWithExpiry(1);

    // Store hashed token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpiry: expiry,
      },
    });

    console.log('[FORGOT_PASSWORD] Reset token generated for user:', user.id);

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      user.email,
      user.name,
      token // Send plain token, not hashed
    );

    if (!emailSent) {
      console.error('[FORGOT_PASSWORD] Failed to send reset email to:', user.email);
      // Don't fail the request - just log it
    } else {
      console.log('[FORGOT_PASSWORD] Reset email sent to:', user.email);
    }

    return NextResponse.json({
      message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('[FORGOT_PASSWORD] Validation error:', error.issues);
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

    console.error('[FORGOT_PASSWORD] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
