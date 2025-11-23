import { getMercadoPagoConfig } from './lib/mercadopago/config';
import { createCustomer } from './lib/mercadopago/cards';

async function testMPConfig() {
  console.log('[TEST] Buscando configuração do MP...');

  const config = await getMercadoPagoConfig();

  if (!config) {
    console.error('[TEST] ❌ Configuração não encontrada!');
    return;
  }

  console.log('[TEST] ✅ Configuração encontrada:');
  console.log('  - Public Key:', config.publicKey);
  console.log('  - Access Token:', config.accessToken?.substring(0, 20) + '...');
  console.log('  - Sandbox:', config.sandboxMode);

  console.log('\n[TEST] Testando criação de customer...');

  try {
    const customer = await createCustomer({
      email: 'teste@example.com',
      firstName: 'Teste',
      lastName: 'Cliente',
    });

    console.log('[TEST] ✅ Customer criado com sucesso!');
    console.log('  - ID:', customer.id);
  } catch (error) {
    console.error('[TEST] ❌ Erro ao criar customer:');
    console.error(error);
  }
}

testMPConfig().catch(console.error);
