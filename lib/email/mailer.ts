 
import type { Transporter } from 'nodemailer';
import { getEmailConfig } from './config';

/**
 * Obtém a URL base para links em emails
 * Prioriza EMAIL_PUBLIC_URL (URL pública) sobre NEXT_PUBLIC_APP_URL (pode ser localhost)
 */
function getEmailBaseUrl(): string {
  return process.env.EMAIL_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// Dynamic import to avoid ESM/CommonJS issues
function getNodemailer(): typeof import('nodemailer') {
  return require('nodemailer');
}

// Function to create transporter (lazy initialization to ensure config is loaded from DB)
async function createTransporter(): Promise<Transporter> {
  // Buscar configuração do banco de dados
  const config = await getEmailConfig();

  if (!config) {
    throw new Error(
      'Email configuration not found. Please configure SMTP settings in /admin/configuracoes'
    );
  }

  console.log('[MAILER] Creating transporter with:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
  });

  const nodemailer = getNodemailer();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the configured SMTP server
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    // Buscar configuração do banco
    const config = await getEmailConfig();

    if (!config) {
      console.error('[EMAIL] No email configuration found');
      return false;
    }

    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Fallback to HTML without tags
    });

    console.log('[EMAIL] Message sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
    return false;
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  const baseUrl = getEmailBaseUrl();
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifique seu email - Envio Legal</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: #1890ff; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Envio Legal</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Olá, ${name}!</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Bem-vindo ao Envio Legal! Para começar a usar sua conta, precisamos verificar seu endereço de email.
                  </p>
                  <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Clique no botão abaixo para confirmar seu email:
                  </p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="${verificationUrl}" style="display: inline-block; background-color: #1890ff; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 4px; font-size: 16px; font-weight: bold;">
                          Verificar Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                    Se você não criou uma conta no Envio Legal, pode ignorar este email com segurança.
                  </p>

                  <!-- Fallback URL -->
                  <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.6; word-break: break-all;">
                    Ou copie e cole este link no seu navegador:<br>
                    <a href="${verificationUrl}" style="color: #1890ff;">${verificationUrl}</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f5f5f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e8e8e8;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Envio Legal. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Verifique seu email - Envio Legal',
    html,
  });
}

/**
 * Send password changed notification email
 */
export async function sendPasswordChangedEmail(
  to: string,
  name: string,
  metadata: {
    changedAt: Date;
    ip?: string;
    userAgent?: string;
  }
): Promise<boolean> {
  const baseUrl = getEmailBaseUrl();
  const securityUrl = `${baseUrl}/minha-conta#security`;

  const formattedDate = metadata.changedAt.toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Senha alterada - Envio Legal</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: #52c41a; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Envio Legal</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Olá, ${name}!</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Sua senha foi alterada com sucesso em <strong>${formattedDate}</strong>.
                  </p>

                  <!-- Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6ffed; border-radius: 4px; border-left: 3px solid #52c41a; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 10px 0; color: #52c41a; font-size: 14px; font-weight: bold;">
                          ✓ Alteração confirmada
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Todas as sessões anteriores foram encerradas por segurança. Use sua nova senha para fazer login novamente.
                        </p>
                      </td>
                    </tr>
                  </table>

                  ${metadata.ip || metadata.userAgent ? `
                  <p style="margin: 20px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6;">
                    <strong>Detalhes da alteração:</strong><br>
                    ${metadata.ip ? `• Endereço IP: ${metadata.ip}<br>` : ''}
                    ${metadata.userAgent ? `• Dispositivo: ${metadata.userAgent.slice(0, 100)}...` : ''}
                  </p>
                  ` : ''}

                  <!-- Warning Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff7e6; border-radius: 4px; border-left: 3px solid #fa8c16; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 10px 0; color: #fa8c16; font-size: 14px; font-weight: bold;">
                          ⚠ Você não reconhece esta alteração?
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Se você não realizou esta alteração, sua conta pode estar comprometida. Entre em contato com nosso suporte imediatamente.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="${securityUrl}" style="display: inline-block; background-color: #1890ff; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 4px; font-size: 16px; font-weight: bold;">
                          Acessar Configurações de Segurança
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                    Esta é uma notificação automática de segurança. Por favor, não responda este email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f5f5f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e8e8e8;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Envio Legal. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Senha alterada com sucesso - Envio Legal',
    html,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinir senha - Envio Legal</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: #1890ff; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Envio Legal</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Olá, ${name}!</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta.
                  </p>

                  <!-- Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-radius: 4px; border-left: 3px solid #1890ff; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 10px 0; color: #1890ff; font-size: 14px; font-weight: bold;">
                          ℹ Link válido por 1 hora
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Clique no botão abaixo para criar uma nova senha. Este link expira em 1 hora e pode ser usado apenas uma vez.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; background-color: #1890ff; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 4px; font-size: 16px; font-weight: bold;">
                          Redefinir Senha
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    Ou copie e cole este link no seu navegador:
                  </p>
                  <p style="margin: 0 0 20px 0; padding: 10px; background-color: #f5f5f5; border-radius: 4px; color: #1890ff; font-size: 12px; word-break: break-all;">
                    ${resetUrl}
                  </p>

                  <!-- Warning Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff7e6; border-radius: 4px; border-left: 3px solid #fa8c16; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 10px 0; color: #fa8c16; font-size: 14px; font-weight: bold;">
                          ⚠ Você não solicitou esta alteração?
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Se você não solicitou a redefinição de senha, ignore este email. Sua senha permanecerá inalterada.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                    Esta é uma notificação automática de segurança. Por favor, não responda este email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Envio Legal. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Redefinir senha - Envio Legal',
    html,
  });
}
