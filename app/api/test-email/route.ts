/**
 * GET /api/test-email
 *
 * Endpoint protegido para testar configuração de email
 * Requer autenticação de administrador com permissão CONFIGURACOES
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { sendEmail } from '@/lib/email/mailer';

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Obter email de destino do body (opcional, usa o email do admin por padrão)
    const body = await req.json().catch(() => ({}));
    const testEmail = body.to || authResult.user.email;

    if (!testEmail) {
      return NextResponse.json(
        { error: 'Email de destino não fornecido' },
        { status: 400 }
      );
    }

    console.log('[TEST_EMAIL] Sending test email to:', testEmail);

    // Enviar email de teste usando a configuração do banco
    const success = await sendEmail({
      to: testEmail,
      subject: 'Teste de Configuração SMTP - Envio Legal',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Teste de Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="color: #52c41a; margin-top: 0;">✓ Configuração SMTP Funcionando!</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.6;">
              Este é um email de teste enviado pelo sistema Envio Legal.
            </p>
            <p style="color: #666666; font-size: 16px; line-height: 1.6;">
              Se você recebeu este email, significa que suas configurações SMTP estão corretas e funcionando perfeitamente.
            </p>
            <p style="color: #999999; font-size: 14px; margin-top: 30px;">
              Enviado em: ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (success) {
      console.log('[TEST_EMAIL] Email sent successfully');
      return NextResponse.json({
        success: true,
        message: `Email de teste enviado com sucesso para ${testEmail}`,
      });
    } else {
      throw new Error('Falha ao enviar email. Verifique as configurações SMTP.');
    }
  } catch (error) {
    console.error('[TEST_EMAIL] Error:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Erro ao enviar email de teste',
      },
      { status: 500 }
    );
  }
}
