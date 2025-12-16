/**
 * E-mails para o módulo de Pagamento pelo Destinatário
 *
 * Templates:
 * - sendRecipientPaymentRequestEmail: Envia link de pagamento para o destinatário
 * - sendRecipientPaymentConfirmedEmail: Confirma que o pagamento foi realizado
 * - sendRecipientPaymentExpiredEmail: Notifica que o link expirou
 * - sendRecipientPaymentReminderEmail: Lembrete 24h antes de expirar
 */

import { sendEmail } from './mailer';
import { formatBRL } from '@/lib/utils/format';

// Helper local para formatar valores monetários (valor já em reais)
const formatCurrency = (value: number) => formatBRL(value);

/**
 * Obtém a URL base para links em emails
 */
function getEmailBaseUrl(): string {
  return process.env.EMAIL_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Formata tempo restante até expiração
 */
function formatTimeUntilExpiration(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  }

  const days = Math.floor(hours / 24);
  return `${days} dia${days !== 1 ? 's' : ''}`;
}

// ============================================================================
// EMAIL 1: SOLICITAÇÃO DE PAGAMENTO (para o destinatário)
// ============================================================================

export interface RecipientPaymentRequestEmailData {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  paymentToken: string;
  expiresAt: Date;
  totalCents: number;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  carrier: string;
  service: string;
  estimatedDays?: number | null;
  packagesCount: number;
}

/**
 * Envia e-mail com link de pagamento para o destinatário
 */
export async function sendRecipientPaymentRequestEmail(
  data: RecipientPaymentRequestEmailData
): Promise<boolean> {
  const baseUrl = getEmailBaseUrl();
  const paymentUrl = `${baseUrl}/pagar/${data.paymentToken}`;
  const totalFormatted = formatCurrency(data.totalCents / 100);
  const timeRemaining = formatTimeUntilExpiration(data.expiresAt);

  const expiresFormatted = data.expiresAt.toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Solicitacao de Pagamento de Frete - Envio Legal</title>
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
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Ola, ${data.recipientName}!</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    <strong>${data.senderName}</strong> quer enviar uma encomenda para voce e solicita que voce pague o frete.
                  </p>

                  <!-- Shipment Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; border-radius: 8px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Origem:</strong> ${data.originCity}/${data.originState}
                        </p>
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Destino:</strong> ${data.destinationCity}/${data.destinationState}
                        </p>
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Transportadora:</strong> ${data.carrier} - ${data.service}
                        </p>
                        ${data.estimatedDays ? `
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Prazo estimado:</strong> ${data.estimatedDays} dia${data.estimatedDays !== 1 ? 's' : ''} uteis
                        </p>
                        ` : ''}
                        <p style="margin: 0; color: #666666; font-size: 14px;">
                          <strong>Volumes:</strong> ${data.packagesCount} volume${data.packagesCount !== 1 ? 's' : ''}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Price Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-radius: 8px; border: 2px solid #1890ff; margin: 25px 0;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;">
                          Valor do Frete
                        </p>
                        <p style="margin: 0; color: #1890ff; font-size: 32px; font-weight: bold;">
                          ${totalFormatted}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Warning Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff7e6; border-radius: 4px; border-left: 3px solid #fa8c16; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px 0; color: #fa8c16; font-size: 14px; font-weight: bold;">
                          Prazo para pagamento
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Este link expira em <strong>${timeRemaining}</strong> (${expiresFormatted}).<br>
                          Apos esse prazo, a solicitacao sera cancelada automaticamente.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${paymentUrl}" style="display: inline-block; background-color: #52c41a; color: #ffffff; text-decoration: none; padding: 18px 60px; border-radius: 4px; font-size: 18px; font-weight: bold;">
                          Pagar Frete
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                    Ou acesse: <a href="${paymentUrl}" style="color: #1890ff;">${paymentUrl}</a>
                  </p>

                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6;">
                    Se voce nao conhece o remetente ou nao esta esperando esta encomenda, ignore este e-mail.
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
    to: data.recipientEmail,
    subject: `${data.senderName} solicita pagamento de frete - Envio Legal`,
    html,
  });
}

// ============================================================================
// EMAIL 2: PAGAMENTO CONFIRMADO (para o destinatário)
// ============================================================================

export interface RecipientPaymentConfirmedEmailData {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  trackingCode: string;
  totalCents: number;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  carrier: string;
  service: string;
  estimatedDays?: number | null;
}

/**
 * Envia e-mail confirmando o pagamento e informando o codigo de rastreio
 */
export async function sendRecipientPaymentConfirmedEmail(
  data: RecipientPaymentConfirmedEmailData
): Promise<boolean> {
  const baseUrl = getEmailBaseUrl();
  const trackingUrl = `${baseUrl}/rastreio/${data.trackingCode}`;
  const totalFormatted = formatCurrency(data.totalCents / 100);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento Confirmado - Envio Legal</title>
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
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Pagamento confirmado!</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Ola <strong>${data.recipientName}</strong>, seu pagamento de <strong>${totalFormatted}</strong> foi confirmado com sucesso!
                  </p>

                  <!-- Success Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6ffed; border-radius: 4px; border-left: 3px solid #52c41a; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px 0; color: #52c41a; font-size: 14px; font-weight: bold;">
                          Envio registrado
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Sua encomenda de <strong>${data.senderName}</strong> foi registrada e em breve estara a caminho!
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Tracking Code Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-radius: 8px; border: 2px solid #1890ff; margin: 25px 0;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                          Codigo de Rastreamento
                        </p>
                        <p style="margin: 0; color: #1890ff; font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">
                          ${data.trackingCode}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Shipment Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; border-radius: 8px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Origem:</strong> ${data.originCity}/${data.originState}
                        </p>
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Destino:</strong> ${data.destinationCity}/${data.destinationState}
                        </p>
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Transportadora:</strong> ${data.carrier} - ${data.service}
                        </p>
                        ${data.estimatedDays ? `
                        <p style="margin: 0; color: #666666; font-size: 14px;">
                          <strong>Prazo estimado:</strong> ${data.estimatedDays} dia${data.estimatedDays !== 1 ? 's' : ''} uteis
                        </p>
                        ` : ''}
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${trackingUrl}" style="display: inline-block; background-color: #1890ff; color: #ffffff; text-decoration: none; padding: 16px 50px; border-radius: 4px; font-size: 18px; font-weight: bold;">
                          Rastrear Envio
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                    Ou acesse: <a href="${trackingUrl}" style="color: #1890ff;">${trackingUrl}</a>
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
    to: data.recipientEmail,
    subject: `Pagamento confirmado - Rastreio ${data.trackingCode} - Envio Legal`,
    html,
  });
}

// ============================================================================
// EMAIL 3: LINK EXPIRADO (para o destinatário)
// ============================================================================

export interface RecipientPaymentExpiredEmailData {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
}

/**
 * Envia e-mail notificando que o link de pagamento expirou
 */
export async function sendRecipientPaymentExpiredEmail(
  data: RecipientPaymentExpiredEmailData
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Link de Pagamento Expirado - Envio Legal</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: #ff4d4f; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Envio Legal</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Link de pagamento expirado</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Ola <strong>${data.recipientName}</strong>, o link de pagamento de frete enviado por <strong>${data.senderName}</strong> expirou.
                  </p>

                  <!-- Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff1f0; border-radius: 4px; border-left: 3px solid #ff4d4f; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px 0; color: #ff4d4f; font-size: 14px; font-weight: bold;">
                          Solicitacao cancelada
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          A solicitacao de pagamento para o envio de <strong>${data.originCity}/${data.originState}</strong> para <strong>${data.destinationCity}/${data.destinationState}</strong> foi cancelada por expiracao.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Se ainda deseja receber esta encomenda, entre em contato com o remetente para que ele gere um novo link de pagamento.
                  </p>

                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6;">
                    Este e-mail foi enviado automaticamente. Por favor, nao responda.
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
    to: data.recipientEmail,
    subject: `Link de pagamento expirado - Envio Legal`,
    html,
  });
}

// ============================================================================
// EMAIL 4: LEMBRETE (para o destinatário - 24h antes de expirar)
// ============================================================================

export interface RecipientPaymentReminderEmailData {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  paymentToken: string;
  expiresAt: Date;
  totalCents: number;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
}

/**
 * Envia e-mail de lembrete 24h antes do link expirar
 */
export async function sendRecipientPaymentReminderEmail(
  data: RecipientPaymentReminderEmailData
): Promise<boolean> {
  const baseUrl = getEmailBaseUrl();
  const paymentUrl = `${baseUrl}/pagar/${data.paymentToken}`;
  const totalFormatted = formatCurrency(data.totalCents / 100);
  const timeRemaining = formatTimeUntilExpiration(data.expiresAt);

  const expiresFormatted = data.expiresAt.toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lembrete: Pagamento de Frete Pendente - Envio Legal</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: #fa8c16; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Envio Legal</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Lembrete de pagamento</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Ola <strong>${data.recipientName}</strong>, voce ainda tem um pagamento de frete pendente de <strong>${data.senderName}</strong>.
                  </p>

                  <!-- Urgent Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff7e6; border-radius: 4px; border-left: 3px solid #fa8c16; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px 0; color: #fa8c16; font-size: 14px; font-weight: bold;">
                          O link expira em ${timeRemaining}!
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Apos <strong>${expiresFormatted}</strong>, o link sera invalidado e a solicitacao sera cancelada automaticamente.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Shipment Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; border-radius: 8px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Remetente:</strong> ${data.senderName}
                        </p>
                        <p style="margin: 0 0 12px 0; color: #666666; font-size: 14px;">
                          <strong>Origem:</strong> ${data.originCity}/${data.originState}
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px;">
                          <strong>Destino:</strong> ${data.destinationCity}/${data.destinationState}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Price Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-radius: 8px; border: 2px solid #1890ff; margin: 25px 0;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;">
                          Valor do Frete
                        </p>
                        <p style="margin: 0; color: #1890ff; font-size: 32px; font-weight: bold;">
                          ${totalFormatted}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${paymentUrl}" style="display: inline-block; background-color: #52c41a; color: #ffffff; text-decoration: none; padding: 18px 60px; border-radius: 4px; font-size: 18px; font-weight: bold;">
                          Pagar Agora
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                    Ou acesse: <a href="${paymentUrl}" style="color: #1890ff;">${paymentUrl}</a>
                  </p>

                  <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6;">
                    Se voce nao conhece o remetente ou nao esta esperando esta encomenda, ignore este e-mail.
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
    to: data.recipientEmail,
    subject: `Lembrete: Pague o frete de ${data.senderName} - Expira em ${timeRemaining}`,
    html,
  });
}

// ============================================================================
// EMAIL 5: NOTIFICACAO PARA O REMETENTE (pagamento recebido)
// ============================================================================

export interface SenderPaymentReceivedEmailData {
  senderEmail: string;
  senderName: string;
  recipientName: string;
  trackingCode: string;
  totalCents: number;
  destinationCity: string;
  destinationState: string;
}

/**
 * Envia e-mail para o remetente notificando que o destinatario pagou
 */
export async function sendSenderPaymentReceivedEmail(
  data: SenderPaymentReceivedEmailData
): Promise<boolean> {
  const baseUrl = getEmailBaseUrl();
  const shipmentsUrl = `${baseUrl}/envios`;
  const totalFormatted = formatCurrency(data.totalCents / 100);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento Recebido - Envio Legal</title>
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
                  <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Pagamento recebido!</h2>
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Ola <strong>${data.senderName}</strong>, o destinatario <strong>${data.recipientName}</strong> pagou o frete da encomenda!
                  </p>

                  <!-- Success Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6ffed; border-radius: 4px; border-left: 3px solid #52c41a; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px 0; color: #52c41a; font-size: 14px; font-weight: bold;">
                          Envio criado automaticamente
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          O pagamento de <strong>${totalFormatted}</strong> foi confirmado e o envio para <strong>${data.destinationCity}/${data.destinationState}</strong> foi registrado.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Tracking Code Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-radius: 8px; border: 2px solid #1890ff; margin: 25px 0;">
                    <tr>
                      <td style="padding: 25px; text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                          Codigo de Rastreamento
                        </p>
                        <p style="margin: 0; color: #1890ff; font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">
                          ${data.trackingCode}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e6f7ff; border-radius: 4px; border-left: 3px solid #1890ff; margin: 20px 0;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px 0; color: #1890ff; font-size: 14px; font-weight: bold;">
                          Proximo passo
                        </p>
                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                          Imprima a etiqueta e leve o pacote ao ponto de postagem ou aguarde a coleta, conforme a modalidade escolhida.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${shipmentsUrl}" style="display: inline-block; background-color: #1890ff; color: #ffffff; text-decoration: none; padding: 16px 50px; border-radius: 4px; font-size: 18px; font-weight: bold;">
                          Ver Meus Envios
                        </a>
                      </td>
                    </tr>
                  </table>
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
    to: data.senderEmail,
    subject: `${data.recipientName} pagou o frete - Codigo ${data.trackingCode}`,
    html,
  });
}
