/**
 * GET/POST /api/admin/email-config
 *
 * Gerencia configuração de email SMTP
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/integrations/shared/encryption.service';

export const dynamic = 'force-dynamic';

/**
 * GET - Buscar configuração de email ativa
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Buscar configuração ativa
    const config = await prisma.emailConfig.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return NextResponse.json({ config: null });
    }

    // Retornar config sem a senha (segurança)
    return NextResponse.json({
      config: {
        id: config.id,
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        fromAddress: config.fromAddress,
        fromName: config.fromName,
        status: config.status,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        // NÃO retornar password
      },
    });
  } catch (error) {
    console.error('[ADMIN_EMAIL_CONFIG_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configuração de email' },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar ou atualizar configuração de email
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await req.json();
    const { host, port, secure, user, password, fromAddress, fromName } = body;

    // Validações básicas
    if (!host || !port || !user || !fromAddress || !fromName) {
      return NextResponse.json(
        { error: 'Host, port, user, fromAddress e fromName são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user) || !emailRegex.test(fromAddress)) {
      return NextResponse.json(
        { error: 'Email inválido (user ou fromAddress)' },
        { status: 400 }
      );
    }

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
        port: parseInt(String(port), 10),
        secure: Boolean(secure),
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
        return NextResponse.json(
          { error: 'Password é obrigatório ao criar nova configuração' },
          { status: 400 }
        );
      }

      await prisma.emailConfig.create({
        data: {
          host,
          port: parseInt(String(port), 10),
          secure: Boolean(secure),
          user,
          password: encrypt(password),
          fromAddress,
          fromName,
          status: 'ACTIVE',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração de email salva com sucesso',
    });
  } catch (error) {
    console.error('[ADMIN_EMAIL_CONFIG_POST]', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configuração de email' },
      { status: 500 }
    );
  }
}
