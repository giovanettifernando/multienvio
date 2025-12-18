/**
 * POST /api/admin/clients/reset-password
 *
 * Envia email de redefinição de senha para usuário(s)
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { sendPasswordResetEmail } from '@/platform/email/mailer';
import { z } from 'zod';

interface EmailResult {
  email: string;
  success: boolean;
}

interface AdminClientResetPasswordResponse {
  ok: boolean;
  message: string;
  results: EmailResult[];
}

const AdminClientResetPasswordSchema = z.object({
  ids: z.array(z.string().min(1, 'ID não pode ser vazio')).min(1, 'Pelo menos um ID é obrigatório'),
});

export const POST = withApiHandler<AdminClientResetPasswordResponse>(async ({ req, logger }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const body = await req.json();

  const parsed = AdminClientResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { ids } = parsed.data;

  // Buscar usuários
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Nenhum usuário encontrado',
      status: 404,
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const results: EmailResult[] = [];

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

      logger.info('admin_reset_password_sent', {
        adminId: authResult.user.id,
        userId: user.id,
        userEmail: user.email,
        emailSent,
      });
    } catch (err) {
      logger.error('admin_reset_password_error', { userId: user.id, error: String(err) });
      results.push({ email: user.email, success: false });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    data: {
      ok: true,
      message: `Email de redefinição enviado para ${successCount} de ${users.length} usuário(s)`,
      results,
    },
  };
});
