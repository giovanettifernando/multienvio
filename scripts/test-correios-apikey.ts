/**
 * Script para testar diretamente as funções do cliente Correios com API Key
 * Uso: DATABASE_URL="..." npx tsx scripts/test-correios-apikey.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { encrypt } from '../lib/integrations/shared/encryption.service';
import {
  getCorreiosConfigAsync,
  validateCorreiosConfig,
  getCorreiosToken,
  invalidateCorreiosConfigCache,
  clearTokenCache,
  cotarCorreiosDefault,
} from '../lib/integrations/correios';

const API_KEY = 'cws-ch1_i6JPmMC6bPrLN79UEo6NDQ0MTA4NzEwMDAxNTk6OTkxMjY2Njk1Ng_MTpCejA6nprjKzwPbHBMM5b';

const prisma = new PrismaClient();

async function setupApiKey() {
  console.log('=== Configurando API Key no banco ===');

  // Buscar ou criar carrier
  let carrier = await prisma.carrier.findFirst({
    where: { slug: 'correios' },
  });

  if (!carrier) {
    carrier = await prisma.carrier.create({
      data: {
        name: 'Correios',
        slug: 'correios',
        status: 'ACTIVE',
        environment: 'PRODUCTION',
        baseUrl: 'https://api.correios.com.br',
        timeout: 30000,
        maxRetries: 3,
        description: 'Integração com APIs dos Correios (CWS)',
      },
    });
    console.log('Carrier criado:', carrier.id);
  } else {
    // Atualizar para produção
    carrier = await prisma.carrier.update({
      where: { id: carrier.id },
      data: {
        status: 'ACTIVE',
        environment: 'PRODUCTION',
        baseUrl: 'https://api.correios.com.br',
      },
    });
    console.log('Carrier atualizado:', carrier.id);
  }

  // Desativar credenciais antigas
  await prisma.carrierCredential.updateMany({
    where: { carrierId: carrier.id, isActive: true },
    data: { isActive: false },
  });

  // Criar nova credencial com API Key
  const encryptedApiKey = encrypt(API_KEY);

  const customHeaders: Record<string, string> = {
    apiKey: encryptedApiKey,
  };

  const credential = await prisma.carrierCredential.create({
    data: {
      carrierId: carrier.id,
      environment: 'PRODUCTION',
      authType: 'API_KEY',
      username: '',
      password: '',
      clientId: '',
      customHeaders: customHeaders as unknown as Prisma.InputJsonValue,
      isActive: true,
    },
  });

  console.log('Credencial criada:', credential.id);
  console.log('API Key configurada com sucesso!');

  return carrier;
}

async function testIntegration() {
  console.log('\n=== Testando integração ===');

  // Limpar cache para forçar reload
  invalidateCorreiosConfigCache();
  clearTokenCache();

  // Verificar config
  const config = await getCorreiosConfigAsync();
  console.log('Config carregada:', {
    environment: config.environment,
    apiBase: config.apiBase,
    hasApiKey: !!config.apiKey,
    apiKeyPreview: config.apiKey ? config.apiKey.substring(0, 20) + '...' : null,
  });

  // Validar config
  const validation = validateCorreiosConfig(config);
  console.log('Validação:', {
    valid: validation.valid,
    authMode: validation.authMode,
    errors: validation.errors,
  });

  if (!validation.valid) {
    console.log('❌ Configuração inválida');
    return false;
  }

  // Testar autenticação (obter token/api key)
  console.log('\n--- Teste de Token/Auth ---');
  try {
    const token = await getCorreiosToken();
    console.log('✅ Token/API Key obtido:', token.substring(0, 30) + '...');
  } catch (err) {
    console.log('❌ Erro ao obter token:', err instanceof Error ? err.message : err);
    return false;
  }

  // Testar cotação
  console.log('\n--- Teste de Cotação ---');
  try {
    const cotacoes = await cotarCorreiosDefault({
      cepOrigem: '01310100',
      cepDestino: '22041080',
      pesoGramas: 500,
      comprimentoCm: 20,
      larguraCm: 15,
      alturaCm: 10,
    });

    console.log('✅ Cotação realizada:');
    cotacoes.forEach(c => {
      if (c.precoTotal > 0) {
        console.log(`  - ${c.nomeServico}: R$ ${c.precoTotal.toFixed(2)} (${c.prazoDias} dias)`);
      } else if (c.erros && c.erros.length > 0) {
        console.log(`  - ${c.nomeServico}: ${c.erros.map(e => e.mensagem).join(', ')}`);
      }
    });
  } catch (err) {
    console.log('❌ Erro na cotação:', err instanceof Error ? err.message : err);
  }

  return true;
}

async function main() {
  console.log('🔑 Testando integração Correios com API Key');
  console.log('API Key:', API_KEY.substring(0, 20) + '...\n');

  try {
    await setupApiKey();
    await testIntegration();
    console.log('\n✅ Teste concluído com sucesso!');
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
