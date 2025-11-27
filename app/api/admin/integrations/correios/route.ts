/**
 * GET /api/admin/integrations/correios
 * POST /api/admin/integrations/correios
 *
 * Rotas de configuração da integração Correios (Admin)
 * Suporta credenciais separadas para Produção e Homologação
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
 * Schema de credenciais para um ambiente específico
 */
const environmentCredentialsSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  cartaoPostagem: z.string().optional(),
  contrato: z.string().optional(),
  dr: z.string().optional(),
});

/**
 * Schema de validação para configuração dos Correios
 * Suporta credenciais separadas para cada ambiente
 */
const correiosConfigSchema = z.object({
  // Ambiente ativo para uso
  activeEnvironment: z.enum(['sandbox', 'production']).default('sandbox'),
  // Credenciais de Produção
  production: environmentCredentialsSchema.optional(),
  // Credenciais de Homologação (Sandbox)
  sandbox: environmentCredentialsSchema.optional(),
  // Serviços (compartilhados entre ambientes)
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
});

type CorreiosConfigInput = z.infer<typeof correiosConfigSchema>;

/**
 * Helper para processar credenciais de um ambiente
 */
function processCredentials(
  credential: {
    username: string | null;
    password: string | null;
    clientId: string | null;
    customHeaders: unknown;
  } | null,
  shouldReveal: boolean
): {
  username: string;
  password: string;
  cartaoPostagem: string;
  contrato: string;
  dr: string;
  configured: boolean;
} {
  if (!credential) {
    return {
      username: '',
      password: '',
      cartaoPostagem: '',
      contrato: '',
      dr: '',
      configured: false,
    };
  }

  const customData = (credential.customHeaders as Record<string, unknown>) || {};

  let passwordValue = '';
  if (credential.password) {
    try {
      const decrypted = decrypt(credential.password);
      passwordValue = shouldReveal ? decrypted : (decrypted.length > 0 ? '***' : '');
    } catch {
      passwordValue = '***';
    }
  }

  return {
    username: credential.username || '',
    password: passwordValue,
    cartaoPostagem: credential.clientId || '',
    contrato: (customData.contrato as string) || '',
    dr: (customData.dr as string) || '',
    configured: !!(credential.username && credential.password && credential.clientId),
  };
}

/**
 * GET - Busca configuração atual dos Correios
 * Query params:
 *   - reveal=true: Retorna valores descriptografados
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const shouldReveal = url.searchParams.get('reveal') === 'true';

    // Buscar carrier
    const carrier = await prisma.carrier.findFirst({
      where: { slug: CORREIOS_CARRIER_SLUG },
    });

    if (!carrier) {
      return NextResponse.json({
        configured: false,
        activeEnvironment: 'sandbox',
        production: { configured: false, username: '', password: '', cartaoPostagem: '', contrato: '', dr: '' },
        sandbox: { configured: false, username: '', password: '', cartaoPostagem: '', contrato: '', dr: '' },
        servicos: [],
      });
    }

    // Buscar credenciais de cada ambiente
    const [productionCred, sandboxCred] = await Promise.all([
      prisma.carrierCredential.findFirst({
        where: {
          carrierId: carrier.id,
          environment: 'PRODUCTION',
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.carrierCredential.findFirst({
        where: {
          carrierId: carrier.id,
          environment: 'SANDBOX',
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const productionData = processCredentials(productionCred, shouldReveal);
    const sandboxData = processCredentials(sandboxCred, shouldReveal);

    // Serviços vêm de qualquer credencial (preferência produção)
    const customData = (productionCred?.customHeaders || sandboxCred?.customHeaders || {}) as Record<string, unknown>;

    return NextResponse.json({
      configured: productionData.configured || sandboxData.configured,
      activeEnvironment: carrier.environment === 'SANDBOX' ? 'sandbox' : 'production',
      production: productionData,
      sandbox: sandboxData,
      servicos: customData.servicos || [],
      status: carrier.status,
      lastUpdated: productionCred?.updatedAt || sandboxCred?.updatedAt || carrier.updatedAt,
    });
  } catch (error) {
    console.error('[ADMIN_CORREIOS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar configuração';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * POST - Salva/atualiza configuração dos Correios
 * Suporta credenciais separadas para cada ambiente
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

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

    // Verificar se pelo menos um ambiente tem credenciais completas
    const hasProdCreds = data.production?.username && data.production?.password && data.production?.cartaoPostagem;
    const hasSandboxCreds = data.sandbox?.username && data.sandbox?.password && data.sandbox?.cartaoPostagem;

    if (!hasProdCreds && !hasSandboxCreds) {
      return NextResponse.json(
        {
          message: 'Configure ao menos um ambiente com usuário, senha e cartão de postagem',
        },
        { status: 400 }
      );
    }

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
        carrier = await tx.carrier.create({
          data: {
            name: 'Correios',
            slug: CORREIOS_CARRIER_SLUG,
            status: 'ACTIVE',
            environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
            baseUrl: baseUrls[data.activeEnvironment],
            timeout: 30000,
            maxRetries: 3,
            logoUrl: 'https://www.correios.com.br/++resource++correios/img/logo-correios-blue.svg',
            description: 'Integração com APIs dos Correios (CWS)',
          },
        });
      } else {
        carrier = await tx.carrier.update({
          where: { id: carrier.id },
          data: {
            status: 'ACTIVE',
            environment: data.activeEnvironment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
            baseUrl: baseUrls[data.activeEnvironment],
            updatedAt: new Date(),
          },
        });
      }

      // Processar credenciais de PRODUÇÃO
      if (data.production) {
        await saveEnvironmentCredentials(
          tx,
          carrier.id,
          'PRODUCTION',
          data.production,
          data.servicos
        );
      }

      // Processar credenciais de SANDBOX
      if (data.sandbox) {
        await saveEnvironmentCredentials(
          tx,
          carrier.id,
          'SANDBOX',
          data.sandbox,
          data.servicos
        );
      }

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

    // Invalidar caches
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
          activeEnvironment: data.activeEnvironment,
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

/**
 * Helper para salvar credenciais de um ambiente específico
 */
async function saveEnvironmentCredentials(
  tx: Prisma.TransactionClient,
  carrierId: string,
  environment: 'PRODUCTION' | 'SANDBOX',
  credentials: z.infer<typeof environmentCredentialsSchema>,
  servicos?: z.infer<typeof correiosConfigSchema>['servicos']
) {
  // Se não tem dados válidos, não fazer nada
  if (!credentials.username && !credentials.password && !credentials.cartaoPostagem) {
    return;
  }

  // Buscar credencial existente para este ambiente
  const existingCred = await tx.carrierCredential.findFirst({
    where: {
      carrierId,
      environment,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Detectar se senha está mascarada e recuperar valor real
  let finalPassword = credentials.password || '';
  if (credentials.password === '***' && existingCred?.password) {
    try {
      finalPassword = decrypt(existingCred.password);
    } catch {
      finalPassword = '';
    }
  }

  // Se não tem credenciais válidas para este ambiente, pular
  if (!credentials.username || !finalPassword || !credentials.cartaoPostagem) {
    return;
  }

  // Montar customHeaders
  const customHeaders: Record<string, unknown> = {};
  if (credentials.contrato) customHeaders.contrato = credentials.contrato;
  if (credentials.dr) customHeaders.dr = credentials.dr;
  if (servicos && servicos.length > 0) customHeaders.servicos = servicos;

  // Desativar credenciais antigas deste ambiente
  await tx.carrierCredential.updateMany({
    where: {
      carrierId,
      environment,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Criar nova credencial
  await tx.carrierCredential.create({
    data: {
      carrierId,
      environment,
      authType: 'BASIC',
      username: credentials.username,
      password: encrypt(finalPassword),
      clientId: credentials.cartaoPostagem,
      customHeaders: Object.keys(customHeaders).length > 0
        ? (customHeaders as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      isActive: true,
    },
  });
}
