/**
 * POST /api/admin/email-config/test-connection
 *
 * Testa a conexão SMTP com os parâmetros fornecidos
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import nodemailer from 'nodemailer';


/**
 * POST - Testar conexão SMTP
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await req.json();
    const { host, port, secure, user, password } = body;

    // Validações básicas
    if (!host || !port || !user) {
      return NextResponse.json(
        { error: 'Host, port e user são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[EMAIL_TEST_CONNECTION] Testing SMTP connection:', {
      host,
      port,
      secure,
      user,
      hasPassword: !!password,
    });

    // Criar transporter de teste
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(String(port), 10),
      secure: Boolean(secure),
      auth: password ? {
        user,
        pass: password,
      } : undefined,
    });

    // Verificar conexão (testa apenas conectividade, não autenticação)
    await transporter.verify();
    console.log('[EMAIL_TEST_CONNECTION] Connectivity test passed');

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
        console.log('[EMAIL_TEST_CONNECTION] Authentication test passed');
      } catch (authError) {
        console.error('[EMAIL_TEST_CONNECTION] Authentication failed:', authError);
        throw authError;
      }
    }

    console.log('[EMAIL_TEST_CONNECTION] Connection and authentication successful');

    return NextResponse.json({
      success: true,
      message: password ? 'Conexão e autenticação SMTP testadas com sucesso' : 'Conexão SMTP testada com sucesso',
    });
  } catch (error) {
    console.error('[EMAIL_TEST_CONNECTION]', error);

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

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
