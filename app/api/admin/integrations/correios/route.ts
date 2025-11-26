/**
 * GET /api/admin/integrations/correios
 * POST /api/admin/integrations/correios
 *
 * Rotas de configuração da integração Correios (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission, Prisma } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/integrations/shared/encryption.service';
import { invalidateCorreiosConfigCache, clearTokenCache } from '@/lib/integrations/correios';

const CORREIOS_CARRIER_SLUG = 'correios';

/**
 * Schema de validação para configuração dos Correios
 * Suporta dois modos de autenticação:
 * 1. API Key (novo): apenas apiKey é necessário
 * 2. Legado: username + password + cartaoPostagem
 */
const correiosConfigSchema = z.object({
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  // Modo API Key (novo)
  apiKey: z.string().optional(),
  // Modo Legado
  username: z.string().optional(),
  password: z.string().optional(),
  cartaoPostagem: z.string().optional(),
  // Dados adicionais
  contrato: z.string().optional(),
  dr: z.string().optional(),
  servicos: z
    .array(
      z.object({
        codigoServico: z.string(),
        coProduto: z.string().optional(),
        nomeExibicao: z.string(),
        habilitado: z.boolean().default(true),
        ordemExibicao: z.number().optional(),
      })
    )
    .optional(),
}).refine(
  (data) => {
    // Deve ter API Key OU (username + password + cartaoPostagem)
    const hasApiKey = data.apiKey && data.apiKey.length > 0;
    const hasLegacy = data.username && data.password && data.cartaoPostagem;
    return hasApiKey || hasLegacy;
  },
  {
    message: 'Informe a API Key ou as credenciais legadas (usuário, senha e cartão de postagem)',
  }
);

type CorreiosConfigInput = z.infer<typeof correiosConfigSchema>;

/**
 * GET - Busca configuração atual dos Correios
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Buscar carrier e credenciais
    const carrier = await prisma.carrier.findFirst({
      where: { slug: CORREIOS_CARRIER_SLUG },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!carrier || carrier.credentials.length === 0) {
      return NextResponse.json({
        configured: false,
        data: null,
      });
    }

    const credential = carrier.credentials[0];

    // Extrair dados do customHeaders
    const customData = (credential.customHeaders as Record<string, unknown>) || {};

    // Mascarar senha e apiKey (mostrar apenas ***)
    let maskedPassword = '';
    if (credential.password) {
      try {
        const decrypted = decrypt(credential.password);
        maskedPassword = decrypted.length > 0 ? '***' : '';
      } catch {
        maskedPassword = '***';
      }
    }

    // Verificar se tem API Key (armazenada em customData.apiKey criptografada)
    let maskedApiKey = '';
    const encryptedApiKey = customData.apiKey as string | undefined;
    if (encryptedApiKey) {
      try {
        const decrypted = decrypt(encryptedApiKey);
        maskedApiKey = decrypted.length > 0 ? `${decrypted.substring(0, 10)}...***` : '';
      } catch {
        maskedApiKey = '***';
      }
    }

    // Determinar modo de autenticação
    const authMode = maskedApiKey ? 'apiKey' : 'legacy';

    return NextResponse.json({
      configured: true,
      data: {
        environment: carrier.environment === 'SANDBOX' ? 'sandbox' : 'production',
        authMode,
        // Modo API Key
        apiKey: maskedApiKey,
        // Modo Legado
        username: credential.username || '',
        password: maskedPassword,
        cartaoPostagem: credential.clientId || '',
        // Dados adicionais
        contrato: (customData.contrato as string) || '',
        dr: (customData.dr as string) || '',
        servicos: customData.servicos || [],
        status: carrier.status,
        lastUpdated: credential.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ADMIN_CORREIOS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar configuração';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * POST - Salva/atualiza configuração dos Correios
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Validar payload
    const body = await request.json();
    const parsed = correiosConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: CorreiosConfigInput = parsed.data;

    // Determinar URLs base por ambiente
    const baseUrls = {
      sandbox: 'https://apihom.correios.com.br',
      production: 'https://api.correios.com.br',
    };

    // Buscar ou criar carrier
    let carrier = await prisma.carrier.findFirst({
      where: { slug: CORREIOS_CARRIER_SLUG },
    });

    await prisma.$transaction(async (tx) => {
      if (!carrier) {
        // Criar novo carrier
        carrier = await tx.carrier.create({
          data: {
            name: 'Correios',
            slug: CORREIOS_CARRIER_SLUG,
            status: 'ACTIVE',
            environment: data.environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
            baseUrl: baseUrls[data.environment],
            timeout: 30000,
            maxRetries: 3,
            logoUrl: 'https://www.correios.com.br/++resource++correios/img/logo-correios-blue.svg',
            description: 'Integração com APIs dos Correios (CWS)',
          },
        });
      } else {
        // Atualizar carrier existente
        carrier = await tx.carrier.update({
          where: { id: carrier.id },
          data: {
            status: 'ACTIVE',
            environment: data.environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
            baseUrl: baseUrls[data.environment],
            updatedAt: new Date(),
          },
        });
      }

      // Desativar credenciais antigas
      await tx.carrierCredential.updateMany({
        where: {
          carrierId: carrier.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Buscar credencial anterior para recuperar valores mascarados
      const existingCred = await tx.carrierCredential.findFirst({
        where: {
          carrierId: carrier.id,
          isActive: false,
        },
        orderBy: { createdAt: 'desc' },
        select: { password: true, customHeaders: true },
      });

      const existingCustomData = (existingCred?.customHeaders as Record<string, unknown>) || {};

      // Detectar se senha está mascarada e recuperar valor real
      let finalPassword = data.password || '';
      if (data.password === '***' && existingCred?.password) {
        finalPassword = decrypt(existingCred.password);
      }

      // Detectar se API Key está mascarada e recuperar valor real
      let finalApiKey = data.apiKey || '';
      if (data.apiKey && data.apiKey.includes('...***') && existingCustomData.apiKey) {
        finalApiKey = decrypt(existingCustomData.apiKey as string);
      }

      // Montar customHeaders com dados adicionais
      const customHeaders: Record<string, unknown> = {};
      if (data.contrato) customHeaders.contrato = data.contrato;
      if (data.dr) customHeaders.dr = data.dr;
      if (data.servicos && data.servicos.length > 0) customHeaders.servicos = data.servicos;
      // Armazenar API Key criptografada em customHeaders
      if (finalApiKey) {
        customHeaders.apiKey = encrypt(finalApiKey);
      }

      // Determinar tipo de autenticação
      const hasApiKey = finalApiKey && finalApiKey.length > 0;
      const authType = hasApiKey ? 'API_KEY' : 'BASIC';

      // Criar nova credencial
      await tx.carrierCredential.create({
        data: {
          carrierId: carrier.id,
          environment: data.environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
          authType: authType as 'BASIC' | 'API_KEY' | 'OAUTH2' | 'BEARER' | 'CUSTOM',
          username: data.username || '',
          password: finalPassword ? encrypt(finalPassword) : '',
          clientId: data.cartaoPostagem || '', // Usando clientId para cartão de postagem
          customHeaders: Object.keys(customHeaders).length > 0
            ? (customHeaders as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          isActive: true,
        },
      });

      // Criar endpoints padrão se não existirem
      const endpoints = [
        { operation: 'auth', method: 'POST', path: '/token/v1/autentica/cartaopostagem' },
        { operation: 'quote', method: 'POST', path: '/preco/v1/nacional' },
        { operation: 'deadline', method: 'POST', path: '/prazo/v1/nacional' },
        { operation: 'create_order', method: 'POST', path: '/prepostagem/v2/prepostagens' },
        { operation: 'label', method: 'GET', path: '/prepostagem/v2/etiquetas/{codigo}' },
        { operation: 'tracking', method: 'GET', path: '/rastro/v1/objetos/{codigo}' },
      ];

      for (const ep of endpoints) {
        await tx.carrierEndpoint.upsert({
          where: {
            carrierId_operation: {
              carrierId: carrier.id,
              operation: ep.operation,
            },
          },
          create: {
            carrierId: carrier.id,
            operation: ep.operation,
            method: ep.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
            path: ep.path,
            timeout: 30000,
            retryable: true,
          },
          update: {
            path: ep.path,
            updatedAt: new Date(),
          },
        });
      }
    });

    // Invalidar caches para forçar recarregamento da nova configuração
    invalidateCorreiosConfigCache();
    clearTokenCache();

    if (!carrier) {
      throw new Error('Erro ao criar/atualizar carrier');
    }

    return NextResponse.json(
      {
        message: 'Configuração salva com sucesso',
        carrier: {
          id: carrier.id,
          slug: carrier.slug,
          status: carrier.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ADMIN_CORREIOS_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao salvar configuração';
    return NextResponse.json({ message }, { status: 500 });
  }
}
