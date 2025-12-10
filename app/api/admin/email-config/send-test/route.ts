/**
 * POST /api/admin/email-config/send-test
 *
 * Envia um email de teste usando a configuração SMTP salva
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/integrations/shared/encryption.service';
import { z } from 'zod';

type EmailSendTestResponse = {
  success: boolean;
  message: string;
};

const EmailSendTestSchema = z.object({
  to: z.string().email('Email de destino inválido'),
});

/**
 * POST - Enviar email de teste
 */
export const POST = withApiHandler<EmailSendTestResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const body = await req.json();

  const parsed = EmailSendTestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { to } = parsed.data;

  // Buscar configuração ativa
  const config = await prisma.emailConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!config) {
    throw new ApiError({
      code: 'not_found',
      message: 'Nenhuma configuração de email encontrada. Configure o SMTP primeiro.',
      status: 404,
    });
  }

  console.log('[EMAIL_SEND_TEST] Sending test email to:', to);
  console.log('[EMAIL_SEND_TEST] Config found:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    hasPassword: !!config.password,
    passwordFormat: config.password ? `${config.password.substring(0, 10)}...` : 'EMPTY',
  });

  // Descriptografar senha
  let password: string;
  try {
    password = decrypt(config.password);
    console.log('[EMAIL_SEND_TEST] Password decrypted successfully, length:', password.length);
  } catch (error) {
    console.error('[EMAIL_SEND_TEST] Failed to decrypt password:', error);
    throw new ApiError({
      code: 'decryption_error',
      message: 'Falha ao descriptografar senha. Verifique a ENCRYPTION_KEY e reconfigure o SMTP.',
      status: 500,
    });
  }

  try {
    // Criar transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: password,
      },
    });

    // Enviar email de teste
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to,
      subject: 'Email de Teste - Envio Legal',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f8f9fa;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .info-box {
              background: white;
              border-left: 4px solid #667eea;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="success-icon">✓</div>
            <h1 style="margin: 0;">Email de Teste</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Envio Legal - Sistema de Gestão de Entregas</p>
          </div>

          <div class="content">
            <h2>Configuração SMTP Funcionando!</h2>
            <p>Parabéns! Se você está lendo este email, significa que a configuração SMTP do Envio Legal está funcionando corretamente.</p>

            <div class="info-box">
              <h3 style="margin-top: 0;">Informações da Configuração:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Servidor:</strong> ${config.host}:${config.port}</li>
                <li><strong>Usuário:</strong> ${config.user}</li>
                <li><strong>Remetente:</strong> ${config.fromName} &lt;${config.fromAddress}&gt;</li>
                <li><strong>Conexão Segura:</strong> ${config.secure ? 'Sim (SSL/TLS)' : 'Não (STARTTLS)'}</li>
              </ul>
            </div>

            <p>Este é um email de teste automático enviado através do painel de configurações do administrador.</p>

            <p><strong>Próximos passos:</strong></p>
            <ul>
              <li>Verifique se o email chegou na caixa de entrada</li>
              <li>Confira se o remetente está correto</li>
              <li>Certifique-se de que não foi para spam</li>
            </ul>
          </div>

          <div class="footer">
            <p>Este é um email automático do sistema Envio Legal.</p>
            <p>Data de envio: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        </body>
        </html>
      `,
      text: `
Email de Teste - Envio Legal

Parabéns! Se você está lendo este email, significa que a configuração SMTP do Envio Legal está funcionando corretamente.

Informações da Configuração:
- Servidor: ${config.host}:${config.port}
- Usuário: ${config.user}
- Remetente: ${config.fromName} <${config.fromAddress}>
- Conexão Segura: ${config.secure ? 'Sim (SSL/TLS)' : 'Não (STARTTLS)'}

Este é um email de teste automático enviado através do painel de configurações do administrador.

Próximos passos:
- Verifique se o email chegou na caixa de entrada
- Confira se o remetente está correto
- Certifique-se de que não foi para spam

Data de envio: ${new Date().toLocaleString('pt-BR')}
      `,
    });

    console.log('[EMAIL_SEND_TEST] Test email sent successfully');

    return {
      data: {
        success: true,
        message: `Email de teste enviado para ${to}`,
      },
    };
  } catch (error) {
    console.error('[EMAIL_SEND_TEST]', error);

    // Mensagens de erro mais amigáveis
    let errorMessage = 'Erro ao enviar email de teste';

    if (error instanceof Error) {
      if (error.message.includes('EAUTH')) {
        errorMessage = 'Falha na autenticação. Verifique as credenciais SMTP.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Conexão recusada. Verifique a configuração do servidor.';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Tempo limite excedido ao conectar ao servidor SMTP.';
      } else {
        errorMessage = error.message;
      }
    }

    throw new ApiError({
      code: 'smtp_send_error',
      message: errorMessage,
      status: 500,
    });
  }
});
