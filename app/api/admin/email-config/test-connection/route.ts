/**
 * POST /api/admin/email-config/test-connection
 *
 * Testa a conexão SMTP com os parâmetros fornecidos
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import nodemailer from 'nodemailer';
import { z } from 'zod';

type EmailTestConnectionResponse = {
  success: boolean;
  message: string;
};

const EmailTestConnectionSchema = z.object({
  host: z.string().min(1, 'Host é obrigatório'),
  port: z.number().int().positive('Porta deve ser um número positivo'),
  secure: z.boolean(),
  user: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().optional(),
});

/**
 * POST - Testar conexão SMTP
 */
export const POST = withApiHandler<EmailTestConnectionResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const body = await req.json();

  const parsed = EmailTestConnectionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { host, port, secure, user, password } = parsed.data;

  context.logger.info('email_test_connection_started', { host, port, secure, user, hasPassword: !!password });

  try {
    // Criar transporter de teste
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: password ? {
        user,
        pass: password,
      } : undefined,
    });

    // Verificar conexão (testa apenas conectividade, não autenticação)
    await transporter.verify();

    // Testar autenticação enviando email para si mesmo (sem realmente enviar)
    if (password) {
      try {
        // Tentar enviar email de teste (nodemailer valida auth antes de enviar)
        await transporter.sendMail({
          from: `"Test" <${user}>`,
          to: user,
          subject: 'Test Connection',
          text: 'This is a test',
        });
      } catch (authError) {
        context.logger.error('email_test_connection_auth_failed', { error: String(authError) });
        throw authError;
      }
    }

    context.logger.info('email_test_connection_success', { host, port });

    return {
      data: {
        success: true,
        message: password ? 'Conexão e autenticação SMTP testadas com sucesso' : 'Conexão SMTP testada com sucesso',
      },
    };
  } catch (error) {
    context.logger.error('email_test_connection_failed', { host, port, error: String(error) });

    // Mensagens de erro mais amigáveis
    let errorMessage = 'Erro ao testar conexão SMTP';

    if (error instanceof Error) {
      if (error.message.includes('EAUTH')) {
        errorMessage = 'Falha na autenticação. Verifique o usuário e senha.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Conexão recusada. Verifique o host e porta.';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Tempo limite excedido. Verifique o host e porta.';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Host não encontrado. Verifique o endereço do servidor.';
      } else {
        errorMessage = error.message;
      }
    }

    throw new ApiError({
      code: 'smtp_connection_error',
      message: errorMessage,
      status: 500,
    });
  }
});
