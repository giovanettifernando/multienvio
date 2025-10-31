/* eslint-disable @typescript-eslint/no-require-imports */
import type { Transporter } from 'nodemailer';

// Dynamic import to avoid ESM/CommonJS issues
function getNodemailer(): typeof import('nodemailer') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('nodemailer');
}

// Function to create transporter (lazy initialization to ensure env vars are loaded)
function createTransporter(): Transporter {
  const user = process.env.EMAIL_USER || 'enviolegal@app.neoera.com.br';
  const pass = process.env.EMAIL_PASSWORD || 'Jedi2025@#';

  console.log('[MAILER] Creating transporter with:', {
    host: 'smtp.titan.email',
    port: 587,
    secure: false,
    user,
    passwordLength: pass?.length || 0,
  });

  const nodemailer = getNodemailer();

  return nodemailer.createTransport({
    host: 'smtp.titan.email',
    port: 587,
    secure: false, // Use STARTTLS (not SSL)
    requireTLS: true, // Require STARTTLS
    auth: {
      user,
      pass,
    },
    tls: {
      ciphers: 'SSLv3',
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
    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: `"Envio Legal" <${process.env.EMAIL_USER || 'enviolegal@app.neoera.com.br'}>`,
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/auth/reset/${token}`;

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
                    Recebemos uma solicitação para redefinir a senha da sua conta no Envio Legal.
                  </p>
                  <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Clique no botão abaixo para criar uma nova senha:
                  </p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; background-color: #1890ff; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 4px; font-size: 16px; font-weight: bold;">
                          Redefinir Senha
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 0 0; color: #ff4d4f; font-size: 14px; line-height: 1.6; padding: 12px; background-color: #fff1f0; border-radius: 4px; border-left: 3px solid #ff4d4f;">
                    <strong>Importante:</strong> Este link expira em 1 hora. Se você não solicitou esta redefinição de senha, ignore este email com segurança.
                  </p>

                  <!-- Fallback URL -->
                  <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.6; word-break: break-all;">
                    Ou copie e cole este link no seu navegador:<br>
                    <a href="${resetUrl}" style="color: #1890ff;">${resetUrl}</a>
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
    subject: 'Redefinir senha - Envio Legal',
    html,
  });
}
