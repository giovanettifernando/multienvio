import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { RegisterSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/email/mailer';
import { getCachedRoleByName } from '@/lib/cache';

interface RegisterResponse {
  userId: string;
  email: string;
  message: string;
  emailVerificationSent: boolean;
  emailError?: string;
}

export const POST = withApiHandler<RegisterResponse>(async (context) => {
  const { req, logger } = context;

  try {
    const payload = await req.json();
    logger.info('register_start');

    const data = RegisterSchema.parse(payload);
    logger.debug('register_validated', { hasPhone: !!data.phone });

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      logger.warn('register_email_exists');
      throw new ApiError({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'E-mail já cadastrado',
        status: 409,
        details: { field: 'email' },
      });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Gerar token de verificação de email
    const verificationToken = generateToken();
    const hashedVerificationToken = hashToken(verificationToken);

    // Buscar role "user" padrão (com cache)
    const userRole = await getCachedRoleByName('user');

    if (!userRole) {
      logger.error('register_role_missing');
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        message: 'Erro ao criar usuário',
        status: 500,
      });
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

    logger.info('register_user_created', { userId: user.id });

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
        logger.info('register_email_sent', { userId: user.id });
      } else {
        logger.warn('register_email_failed', { userId: user.id });
        emailError = 'EMAIL_SEND_FAILED';
      }
    } catch (error) {
      logger.error('register_email_error', { userId: user.id, err: error });
      emailError = 'EMAIL_SEND_FAILED';
    }

    return {
      data: {
        userId: user.id,
        email: user.email,
        message: emailVerificationSent
          ? 'Cadastro realizado com sucesso! Verifique seu email para ativar sua conta.'
          : 'Cadastro realizado com sucesso! Não foi possível enviar o email de verificação. Você pode solicitar o reenvio.',
        emailVerificationSent,
        ...(emailError && { emailError }),
      },
      status: 201,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof ZodError) {
      logger.debug('register_validation_error', { issues: error.issues });

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

      throw new ApiError({
        code: errorCode,
        message: mainMessage,
        status: 422,
        details: { errors },
      });
    }

    logger.error('register_error', { err: error });
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir o cadastro',
      status: 500,
    });
  }
});
