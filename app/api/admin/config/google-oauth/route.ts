/**
 * GET /api/admin/config/google-oauth
 * POST /api/admin/config/google-oauth
 *
 * Rotas de configuração das credenciais Google OAuth (Admin)
 */


import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/integrations/shared/encryption.service';

/**
 * Schema de validação para configuração Google OAuth
 */
const googleOAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID é obrigatório'),
  clientSecret: z.string().min(1, 'Client Secret é obrigatório'),
  isActive: z.boolean().default(true),
});

/**
 * GET - Retorna a configuração atual
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Buscar configuração ativa
    const config = await prisma.googleOAuthConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return NextResponse.json({
        configured: false,
        clientId: '',
        clientSecret: '',
        isActive: false,
      });
    }

    // Descriptografar clientSecret para exibição mascarada
    let clientSecretMasked = '';
    try {
      const decrypted = decrypt(config.clientSecret);
      clientSecretMasked = decrypted.length > 0 ? '***configurado***' : '';
    } catch {
      clientSecretMasked = '***';
    }

    return NextResponse.json({
      configured: true,
      clientId: config.clientId,
      clientSecret: clientSecretMasked,
      isActive: config.isActive,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('[ADMIN_GOOGLE_OAUTH_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao carregar configuração' },
      { status: 500 }
    );
  }
}

/**
 * POST - Salva a configuração
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = googleOAuthConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { clientId, clientSecret, isActive } = parsed.data;

    // Criptografar clientSecret
    const encryptedSecret = encrypt(clientSecret);

    // Desativar configurações anteriores
    await prisma.googleOAuthConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Criar nova configuração
    const config = await prisma.googleOAuthConfig.create({
      data: {
        clientId,
        clientSecret: encryptedSecret,
        isActive,
      },
    });

    // Invalidar cache do módulo google-oauth
    try {
      const { invalidateGoogleOAuthCache } = await import('@/lib/auth/google-oauth');
      invalidateGoogleOAuthCache();
    } catch {
      // Cache não implementado ainda
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração salva com sucesso',
      id: config.id,
    });
  } catch (error) {
    console.error('[ADMIN_GOOGLE_OAUTH_POST]', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configuração' },
      { status: 500 }
    );
  }
}
