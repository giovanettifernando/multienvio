/**
 * POST /api/admin/coletores/[id]/reset-password
 *
 * Envia email de redefinição de senha para o coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { SignJWT } from 'jose';
import nodemailer from 'nodemailer';


const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'
);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * POST /api/admin/coletores/[id]/reset-password
 * Envia email de redefinição de senha
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.COLETORES);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    // Buscar coletor
    const collector = await prisma.collector.findUnique({
      where: { id },
      select: {
        id: true,
        pfNome: true,
        pfEmail: true,
        pfEmailVerified: true,
        status: true,
      },
    });

    if (!collector) {
      return NextResponse.json(
        { message: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    if (!collector.pfEmail) {
      return NextResponse.json(
        { message: 'Coletor não possui email cadastrado' },
        { status: 400 }
      );
    }

    if (!collector.pfEmailVerified) {
      return NextResponse.json(
        { message: 'Email do coletor não foi verificado' },
        { status: 400 }
      );
    }

    // Gerar token JWT com expiração de 1 hora
    const resetToken = await new SignJWT({
      collectorId: collector.id,
      email: collector.pfEmail,
      type: 'password-reset',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET);

    // Buscar configuração de email
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!emailConfig) {
      console.error('[RESET_PASSWORD] Nenhuma configuração de email encontrada');
      return NextResponse.json(
        { message: 'Configuração de email não encontrada. Configure o SMTP primeiro.' },
        { status: 500 }
      );
    }

    // Descriptografar senha
    const { decrypt } = await import('@/lib/integrations/shared/encryption.service');
    const password = decrypt(emailConfig.password);

    // Criar transporter
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: password,
      },
    });

    // URL base do app
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/coletor/redefinir-senha?token=${resetToken}`;

    // Enviar email
    await transporter.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`,
      to: collector.pfEmail,
      subject: 'Redefinir sua senha - Envio Legal',
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
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
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
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">Redefinir Senha</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Envio Legal - Sistema de Coletores</p>
          </div>

          <div class="content">
            <p>Olá <strong>${collector.pfNome}</strong>,</p>

            <p>Recebemos uma solicitação para redefinir a senha da sua conta de coletor no Envio Legal.</p>

            <p>Para criar uma nova senha, clique no botão abaixo:</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Redefinir Senha</a>
            </div>

            <div class="warning">
              <strong>⚠️ Atenção:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Este link é válido por <strong>1 hora</strong></li>
                <li>Se você não solicitou esta redefinição, ignore este email</li>
                <li>Nunca compartilhe este link com outras pessoas</li>
              </ul>
            </div>

            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>

          <div class="footer">
            <p>Este é um email automático do sistema Envio Legal.</p>
            <p>Data de envio: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        </body>
        </html>
      `,
      text: `
Redefinir Senha - Envio Legal

Olá ${collector.pfNome},

Recebemos uma solicitação para redefinir a senha da sua conta de coletor no Envio Legal.

Para criar uma nova senha, acesse o link abaixo:
${resetUrl}

ATENÇÃO:
- Este link é válido por 1 hora
- Se você não solicitou esta redefinição, ignore este email
- Nunca compartilhe este link com outras pessoas

Data de envio: ${new Date().toLocaleString('pt-BR')}
      `,
    });

    console.log('[RESET_PASSWORD] Email enviado para:', collector.pfEmail);

    return NextResponse.json(
      { message: 'Email de redefinição de senha enviado com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RESET_PASSWORD]', error);

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao enviar email de redefinição',
      },
      { status: 500 }
    );
  }
}
