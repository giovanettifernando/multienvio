/**
 * GET/POST /api/admin/email-config
 *
 * Gerencia configuração de email SMTP
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission, EmailConfigStatus } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import { z } from 'zod';

type EmailConfigData = {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
  status: EmailConfigStatus;
  createdAt: Date;
  updatedAt: Date;
} | null;

type EmailConfigGetResponse = {
  config: EmailConfigData;
};

type EmailConfigPostResponse = {
  success: boolean;
  message: string;
};

const EmailConfigSchema = z.object({
  host: z.string().min(1, 'Host é obrigatório'),
  port: z.number().int().positive('Porta deve ser um número positivo'),
  secure: z.boolean(),
  user: z.string().email('Email de usuário inválido'),
  password: z.string().optional(),
  fromAddress: z.string().email('Email de remetente inválido'),
  fromName: z.string().min(1, 'Nome do remetente é obrigatório'),
});

/**
 * GET - Buscar configuração de email ativa
 * Query params:
 *   - reveal=true: Retorna password descriptografado
 */
export const GET = withApiHandler<EmailConfigGetResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const url = new URL(req.url);
  const shouldReveal = url.searchParams.get('reveal') === 'true';

  // Buscar configuração ativa
  const config = await prisma.emailConfig.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!config) {
    return { data: { config: null } };
  }

  // Descriptografar password se reveal=true
  let passwordValue = '';
  if (config.password) {
    try {
      const decrypted = decrypt(config.password);
      passwordValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***configurado***' : '');
    } catch {
      passwordValue = shouldReveal ? '' : '***';
    }
  }

  return {
    data: {
      config: {
        id: config.id,
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        password: passwordValue,
        fromAddress: config.fromAddress,
        fromName: config.fromName,
        status: config.status,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    },
  };
});

/**
 * POST - Criar ou atualizar configuração de email
 */
export const POST = withApiHandler<EmailConfigPostResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const body = await req.json();

  const parsed = EmailConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { host, port, secure, user, password, fromAddress, fromName } = parsed.data;

  // Buscar configuração ativa existente
  const existingConfig = await prisma.emailConfig.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (existingConfig) {
    // Atualizar configuração existente
    const updateData: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password?: string;
      fromAddress: string;
      fromName: string;
      status: 'ACTIVE' | 'INACTIVE';
    } = {
      host,
      port,
      secure,
      user,
      fromAddress,
      fromName,
      status: 'ACTIVE',
    };

    // Criptografar senha apenas se fornecida
    if (password) {
      updateData.password = encrypt(password);
    }

    await prisma.emailConfig.update({
      where: { id: existingConfig.id },
      data: updateData,
    });
  } else {
    // Criar nova configuração (senha é obrigatória)
    if (!password) {
      throw new ApiError({
        code: 'validation_error',
        message: 'Password é obrigatório ao criar nova configuração',
        status: 400,
      });
    }

    await prisma.emailConfig.create({
      data: {
        host,
        port,
        secure,
        user,
        password: encrypt(password),
        fromAddress,
        fromName,
        status: 'ACTIVE',
      },
    });
  }

  return {
    data: {
      success: true,
      message: 'Configuração de email salva com sucesso',
    },
  };
});
