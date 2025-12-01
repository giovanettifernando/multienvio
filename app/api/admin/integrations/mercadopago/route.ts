/**
 * GET /api/admin/integrations/mercadopago
 * POST /api/admin/integrations/mercadopago
 *
 * Rotas de configuração do gateway Mercado Pago (Admin)
 */


import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/integrations/shared/encryption.service';
import { invalidateConfigCache } from '@/lib/mercadopago';

/**
 * Schema de validação para configuração do Mercado Pago
 */
const mercadoPagoConfigSchema = z.object({
  publicKey: z.string().min(1, 'Public Key é obrigatória'),
  accessToken: z.string().min(1, 'Access Token é obrigatório'),
  webhookSecret: z.string().optional(),
  webhookUrl: z.string().url('URL do webhook inválida').optional(),
  sandboxMode: z.boolean().default(true),
});

type MercadoPagoConfigInput = z.infer<typeof mercadoPagoConfigSchema>;

/**
 * GET - Busca configuração atual do Mercado Pago
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Buscar gateway e credenciais
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago' },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        endpoints: {
          where: { operation: 'webhook' },
          take: 1,
        },
      },
    });

    if (!gateway || gateway.credentials.length === 0) {
      return NextResponse.json({
        configured: false,
        data: null,
      });
    }

    const credential = gateway.credentials[0];
    const webhookEndpoint = gateway.endpoints[0];

    // Mascarar access token (mostrar apenas últimos 4 caracteres)
    let maskedAccessToken = '';
    if (credential.accessToken) {
      try {
        const decrypted = decrypt(credential.accessToken);
        maskedAccessToken = decrypted.length > 4
          ? `***${decrypted.slice(-4)}`
          : '***';
      } catch {
        maskedAccessToken = '***';
      }
    }

    // Mascarar webhook secret
    let maskedWebhookSecret = '';
    if (credential.secretKey) {
      try {
        const decrypted = decrypt(credential.secretKey);
        maskedWebhookSecret = decrypted.length > 4
          ? `***${decrypted.slice(-4)}`
          : '***';
      } catch {
        maskedWebhookSecret = '***';
      }
    }

    return NextResponse.json({
      configured: true,
      data: {
        publicKey: credential.publicKey || '',
        accessToken: maskedAccessToken,
        webhookSecret: maskedWebhookSecret,
        webhookUrl: webhookEndpoint?.path || '',
        sandboxMode: gateway.environment === 'SANDBOX',
        status: gateway.status,
        lastUpdated: credential.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ADMIN_MERCADOPAGO_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar configuração';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * POST - Salva/atualiza configuração do Mercado Pago
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Validar payload
    const body = await request.json();
    const parsed = mercadoPagoConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: MercadoPagoConfigInput = parsed.data;

    // Buscar ou criar gateway
    let gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago' },
    });

    await prisma.$transaction(async (tx) => {
      if (!gateway) {
        // Criar novo gateway
        gateway = await tx.paymentGateway.create({
          data: {
            name: 'Mercado Pago',
            slug: 'mercadopago',
            status: 'ACTIVE',
            environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
            baseUrl: data.sandboxMode
              ? 'https://api.mercadopago.com'
              : 'https://api.mercadopago.com',
            timeout: 30000,
            enabledMethods: ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO'],
            logoUrl: 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.1/mercadopago/logo__large@2x.png',
            description: 'Gateway de pagamento Mercado Pago',
          },
        });
      } else {
        // Atualizar gateway existente
        gateway = await tx.paymentGateway.update({
          where: { id: gateway.id },
          data: {
            status: 'ACTIVE',
            environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
            updatedAt: new Date(),
          },
        });
      }

      // Desativar credenciais antigas
       
      const _oldCredentials = await tx.paymentCredential.updateMany({
        where: {
          gatewayId: gateway.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Detectar se tokens estão mascarados e recuperar valores reais
      let finalAccessToken = data.accessToken;
      let finalWebhookSecret = data.webhookSecret;

      // 🔒 SECURITY: Não logar prévias de tokens para evitar exposição em logs
      console.log('[ADMIN_MERCADOPAGO_POST] Verificando tokens:', {
        accessTokenIsMasked: data.accessToken.startsWith('***'),
        webhookSecretIsMasked: data.webhookSecret?.startsWith('***'),
      });

      // Se o access token está mascarado (começa com ***), recuperar o token real
      if (data.accessToken.startsWith('***')) {
        const existingCred = await tx.paymentCredential.findFirst({
          where: {
            gatewayId: gateway.id,
            isActive: false, // Acabamos de desativar
          },
          orderBy: { createdAt: 'desc' },
          select: { accessToken: true },
        });

        if (existingCred?.accessToken) {
          // Usar o token criptografado existente (já está criptografado, não criptografar novamente)
          finalAccessToken = decrypt(existingCred.accessToken); // Descriptografar para re-criptografar depois
          // 🔒 SECURITY: Não logar preview do token
          console.log('[ADMIN_MERCADOPAGO_POST] Token mascarado detectado. Recuperado token existente.');
        } else {
          throw new Error('Token mascarado detectado mas não há credencial anterior. Por favor, insira o Access Token completo.');
        }
      }

      // Se o webhook secret está mascarado (começa com ***), recuperar o secret real
      if (finalWebhookSecret && finalWebhookSecret.startsWith('***')) {
        const existingCred = await tx.paymentCredential.findFirst({
          where: {
            gatewayId: gateway.id,
            isActive: false,
          },
          orderBy: { createdAt: 'desc' },
          select: { secretKey: true },
        });

        if (existingCred?.secretKey) {
          finalWebhookSecret = decrypt(existingCred.secretKey); // Descriptografar para re-criptografar depois
        } else {
          // Webhook secret é opcional, então não lançar erro
          finalWebhookSecret = undefined;
        }
      }

      // Criar nova credencial
      await tx.paymentCredential.create({
        data: {
          gatewayId: gateway.id,
          environment: data.sandboxMode ? 'SANDBOX' : 'PRODUCTION',
          authType: 'BEARER',
          publicKey: data.publicKey,
          accessToken: encrypt(finalAccessToken), // Criptografar
          secretKey: finalWebhookSecret ? encrypt(finalWebhookSecret) : null,
          isActive: true,
        },
      });

      // Criar/atualizar endpoint de webhook se fornecido
      if (data.webhookUrl) {
        await tx.paymentEndpoint.upsert({
          where: {
            gatewayId_operation: {
              gatewayId: gateway.id,
              operation: 'webhook',
            },
          },
          create: {
            gatewayId: gateway.id,
            operation: 'webhook',
            method: 'POST',
            path: data.webhookUrl,
            timeout: 30000,
            retryable: true,
          },
          update: {
            path: data.webhookUrl,
            updatedAt: new Date(),
          },
        });
      }
    });

    // Invalidar cache de configuração
    invalidateConfigCache();

    // Gateway não pode ser null aqui pois foi criado/atualizado na transaction
    if (!gateway) {
      throw new Error('Erro ao criar/atualizar gateway');
    }

    return NextResponse.json(
      {
        message: 'Configuração salva com sucesso',
        gateway: {
          id: gateway.id,
          slug: gateway.slug,
          status: gateway.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ADMIN_MERCADOPAGO_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao salvar configuração';
    return NextResponse.json({ message }, { status: 500 });
  }
}
