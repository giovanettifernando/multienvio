import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/email/mailer';


const ResendSchema = z.object({
  email: z.string().email('Email inválido'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = ResendSchema.parse(body);

    console.log('[RESEND_VERIFICATION] Resending verification email to:', email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return NextResponse.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um novo link de verificação.',
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      console.log('[RESEND_VERIFICATION] Email already verified:', email);
      return NextResponse.json({
        success: true,
        message: 'Este email já foi verificado. Você pode fazer login.',
        code: 'ALREADY_VERIFIED',
      });
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const hashedVerificationToken = hashToken(verificationToken);

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedVerificationToken,
      },
    });

    console.log('[RESEND_VERIFICATION] New token generated for user:', user.id);

    // Send verification email
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(user.email, user.name, verificationToken);

      if (emailSent) {
        console.log('[RESEND_VERIFICATION] Verification email sent to:', user.email);
      } else {
        console.error('[RESEND_VERIFICATION] Failed to send email to:', user.email);
      }
    } catch (error) {
      console.error('[RESEND_VERIFICATION] Error sending email:', error);
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Email de verificação reenviado com sucesso! Verifique sua caixa de entrada.'
        : 'Não foi possível enviar o email. Tente novamente em alguns minutos.',
      emailSent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email inválido',
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('[RESEND_VERIFICATION] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao processar solicitação',
      },
      { status: 500 }
    );
  }
}
