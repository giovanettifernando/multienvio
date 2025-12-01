import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { RegisterSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/email/mailer';


export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('[REGISTER] Received payload:', JSON.stringify(payload, null, 2));

    const data = RegisterSchema.parse(payload);
    console.log('[REGISTER] Validated data:', { email: data.email, name: data.name, hasPhone: !!data.phone });

    console.log('[REGISTER] Attempting to register user:', data.email);

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      console.log('[REGISTER] Email already exists:', data.email);
      return NextResponse.json(
        {
          message: 'E-mail já cadastrado',
          code: 'EMAIL_ALREADY_IN_USE',
          field: 'email'
        },
        { status: 409 }
      );
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Gerar token de verificação de email
    const verificationToken = generateToken();
    const hashedVerificationToken = hashToken(verificationToken);

    // Buscar role "user" padrão
    const userRole = await prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      console.error('[REGISTER] Role "user" not found in database');
      return NextResponse.json(
        { message: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Criar usuário com status pending até verificar email
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        status: 'pending', // User must verify email before being active
        emailVerified: false,
        emailVerificationToken: hashedVerificationToken,
        termsAcceptedAt: new Date(), // Record terms acceptance
        roleId: userRole.id,
      },
      include: {
        role: true,
      },
    });

    console.log('[REGISTER] User created:', user.id);

    // Enviar email de verificação (não falhar o cadastro se email falhar)
    let emailVerificationSent = false;
    let emailError = null;

    try {
      emailVerificationSent = await sendVerificationEmail(
        user.email,
        user.name,
        verificationToken // Send plain token, not hashed
      );

      if (emailVerificationSent) {
        console.log('[REGISTER] Verification email sent to:', user.email);
      } else {
        console.warn('[REGISTER] Failed to send verification email to:', user.email);
        emailError = 'EMAIL_SEND_FAILED';
      }
    } catch (error) {
      console.error('[REGISTER] Error sending verification email:', error);
      emailError = 'EMAIL_SEND_FAILED';
    }

    return NextResponse.json(
      {
        userId: user.id,
        email: user.email,
        message: emailVerificationSent
          ? 'Cadastro realizado com sucesso! Verifique seu email para ativar sua conta.'
          : 'Cadastro realizado com sucesso! Não foi possível enviar o email de verificação. Você pode solicitar o reenvio.',
        emailVerificationSent,
        ...(emailError && { emailError }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('[REGISTER] Validation error:', JSON.stringify(error.issues, null, 2));

      // Mapear erros para mensagens mais específicas
      const errors = error.issues.map((issue) => ({
        field: issue.path.join('.') || 'general',
        message: issue.message,
      }));

      // Determinar código de erro específico
      let errorCode = 'VALIDATION_ERROR';
      let mainMessage = 'Dados inválidos';

      if (errors.some(e => e.field.includes('senha') || e.field.includes('password'))) {
        errorCode = 'PASSWORD_POLICY_FAILED';
        mainMessage = 'A senha não atende aos requisitos de segurança';
      } else if (errors.some(e => e.field.includes('email'))) {
        errorCode = 'INVALID_EMAIL';
        mainMessage = 'Email inválido';
      } else if (errors.some(e => e.field.includes('telefone') || e.field.includes('phone'))) {
        errorCode = 'INVALID_PHONE';
        mainMessage = 'Telefone inválido';
      } else if (errors.some(e => e.field.includes('Termos') || e.field.includes('Terms') || e.field.includes('LGPD'))) {
        errorCode = 'TERMS_NOT_ACCEPTED';
        mainMessage = 'Você deve aceitar os termos de uso';
      } else if (errors.some(e => e.field.includes('nome') || e.field.includes('name'))) {
        errorCode = 'MISSING_FIELDS';
        mainMessage = 'Campos obrigatórios faltando';
      }

      return NextResponse.json(
        {
          message: mainMessage,
          code: errorCode,
          errors,
        },
        { status: 422 }
      );
    }

    console.error('[REGISTER] Unexpected error:', error);
    return NextResponse.json(
      {
        message: 'Não foi possível concluir o cadastro',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
