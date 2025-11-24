/**
 * GET/POST /api/admin/payment-gateway/config
 *
 * Gerencia configuração do gateway de pagamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/integrations/shared/encryption.service';

export const dynamic = 'force-dynamic';

/**
 * GET - Buscar configuração atual
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Buscar gateway e credenciais
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago' },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!gateway || gateway.credentials.length === 0) {
      return NextResponse.json({ config: null });
    }

    const credential = gateway.credentials[0];

    return NextResponse.json({
      config: {
        environment: gateway.environment,
        publicKey: credential.publicKey || '',
        // NÃO retornar accessToken/webhookSecret por segurança
      },
    });
  } catch (error) {
    console.error('[ADMIN_GATEWAY_CONFIG_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configuração' },
      { status: 500 }
    );
  }
}

/**
 * POST - Salvar configuração
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await req.json();
    const { environment, publicKey, accessToken, webhookSecret } = body;

    if (!environment || !publicKey) {
      return NextResponse.json(
        { error: 'Environment e publicKey são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar ou criar gateway
    let gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago' },
    });

    if (!gateway) {
      gateway = await prisma.paymentGateway.create({
        data: {
          slug: 'mercadopago',
          name: 'Mercado Pago',
          environment,
          status: 'ACTIVE',
        },
      });
    } else {
      // Atualizar environment
      gateway = await prisma.paymentGateway.update({
        where: { id: gateway.id },
        data: { environment },
      });
    }

    // Buscar credencial ativa
    let credential = await prisma.paymentCredential.findFirst({
      where: {
        gatewayId: gateway.id,
        isActive: true,
      },
    });

    const credentialData: {
      publicKey: string;
      accessToken?: string;
      secretKey?: string;
    } = {
      publicKey,
    };

    // Criptografar accessToken se fornecido
    if (accessToken) {
      credentialData.accessToken = encrypt(accessToken);
    }

    // Criptografar webhookSecret se fornecido
    if (webhookSecret) {
      credentialData.secretKey = encrypt(webhookSecret);
    }

    if (credential) {
      // Atualizar credencial existente
      credential = await prisma.paymentCredential.update({
        where: { id: credential.id },
        data: credentialData,
      });
    } else {
      // Criar nova credencial
      credential = await prisma.paymentCredential.create({
        data: {
          gatewayId: gateway.id,
          environment,
          authType: 'API_KEY',
          ...credentialData,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração salva com sucesso',
    });
  } catch (error) {
    console.error('[ADMIN_GATEWAY_CONFIG_POST]', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configuração' },
      { status: 500 }
    );
  }
}
