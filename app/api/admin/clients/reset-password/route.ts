/**
 * POST /api/admin/clients/reset-password
 *
 * Envia email de redefinição de senha para usuário(s)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { sendPasswordResetEmail } from '@/lib/email/mailer';


export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: 'IDs de usuários são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar usuários
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { message: 'Nenhum usuário encontrado' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const results: { email: string; success: boolean }[] = [];

    for (const user of users) {
      try {
        // Gerar token de reset
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        // Salvar token no banco
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });

        // Construir URL de reset
        const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

        // Enviar email
        const emailSent = await sendPasswordResetEmail(
          user.email,
          user.name,
          resetUrl
        );

        results.push({ email: user.email, success: emailSent });

        console.log('[ADMIN_RESET_PASSWORD]', {
          adminId: authResult.user.id,
          userId: user.id,
          userEmail: user.email,
          emailSent,
        });
      } catch (err) {
        console.error('[ADMIN_RESET_PASSWORD] Error for user:', user.id, err);
        results.push({ email: user.email, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      ok: true,
      message: `Email de redefinição enviado para ${successCount} de ${users.length} usuário(s)`,
      results,
    });
  } catch (error) {
    console.error('[ADMIN_RESET_PASSWORD_ERROR]', error);
    return NextResponse.json(
      { message: 'Erro ao enviar email de redefinição' },
      { status: 500 }
    );
  }
}
