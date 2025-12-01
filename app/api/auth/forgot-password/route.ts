import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForgotPasswordSchema } from '@/lib/validation/auth';
import prisma from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email/mailer';
import crypto from 'crypto';
import { rateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit';


export async function POST(request: Request) {
  // Rate limiting by IP - 3 attempts per 10 minutes
  const rateLimitError = rateLimitByIP(request as NextRequest, 'client_forgot_password', RATE_LIMITS.PASSWORD_RESET);
  if (rateLimitError) return rateLimitError;

  try {
    const payload = await request.json();
    const data = ForgotPasswordSchema.parse(payload);

    console.log('[FORGOT_PASSWORD] Password reset requested for:', data.email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      console.log('[FORGOT_PASSWORD] User not found, but returning success');
      return NextResponse.json({
        message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
      });
    }

    // Generate random token (32 bytes = 256 bits)
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token with SHA-256 for storage
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Expiry: 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token in password_reset_tokens table
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    console.log('[FORGOT_PASSWORD] Reset token created for user:', user.id);

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl
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
