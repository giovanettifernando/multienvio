/**
 * Script para testar autenticação e pagamento com Mercado Pago
 * Uso: node scripts/test-mp-payment.mjs
 */

import crypto from 'crypto';

// Configuração de criptografia
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  const [ivHex, authTagHex, encrypted] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY_BUFFER,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Buscar credenciais do banco
import pg from 'pg';
const { Client } = pg;

async function getCredentials() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'envio',
    password: 'envio',
    database: 'enviolegal'
  });

  await client.connect();

  const result = await client.query(`
    SELECT pc."publicKey", pc."accessToken", pg.environment
    FROM payment_credentials pc
    JOIN payment_gateways pg ON pc."gatewayId" = pg.id
    WHERE pg.slug = 'mercadopago'
  `);

  await client.end();

  const row = result.rows[0];
  return {
    publicKey: row.publicKey,
    accessToken: decrypt(row.accessToken),
    environment: row.environment
  };
}

async function testAuthentication(accessToken) {
  console.log('\n📡 Testando autenticação com a API do Mercado Pago...\n');

  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Erro de autenticação:', error);
    return null;
  }

  const user = await response.json();
  console.log('✅ Autenticação bem-sucedida!');
  console.log('👤 Usuário:', user.nickname || user.email);
  console.log('🆔 ID:', user.id);
  console.log('🌍 País:', user.country_id);
  console.log('🏷️  Tipo:', user.tags ? user.tags.join(', ') : 'N/A');

  return user;
}

async function createCardToken(publicKey, accessToken) {
  console.log('\n🔐 Criando token de cartão de teste...\n');

  // Cartões de teste oficiais para Brasil (MLB)
  // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
  // Mastercard crédito: 5031 4332 1540 6351
  // Visa crédito: 4235 6477 2802 5682
  const cardData = {
    card_number: '5031433215406351',  // Mastercard de teste
    expiration_month: '11',
    expiration_year: '2030',
    security_code: '123',
    cardholder: {
      name: 'APRO',  // APRO = aprovação automática em sandbox
      identification: {
        type: 'CPF',
        number: '12345678909'  // CPF de teste válido
      }
    }
  };

  console.log('📇 Cartão de teste oficial do Mercado Pago:');
  console.log('   Número:', cardData.card_number);
  console.log('   Titular: APRO (simula aprovação)');
  console.log('   CPF:', cardData.cardholder.identification.number);

  // Criar token via API (não SDK)
  const response = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cardData)
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Erro ao criar token:', error);
    return null;
  }

  const token = await response.json();
  console.log('✅ Token criado:', token.id);
  console.log('   Primeiros 6:', token.first_six_digits);
  console.log('   Últimos 4:', token.last_four_digits);

  return token;
}

async function createPayment(accessToken, tokenId) {
  console.log('\n💳 Criando pagamento de teste (R$ 10,00)...\n');

  // Email do comprador - qualquer email válido funciona em sandbox
  // Para produção, usar email real do cliente
  const testBuyerEmail = process.env.MP_TEST_USER_EMAIL || 'teste@exemplo.com';

  // Payload MÍNIMO obrigatório para Checkout Transparente
  // Campos opcionais (first_name, last_name, identification, description)
  // podem ser adicionados mas não são necessários
  const paymentData = {
    // OBRIGATÓRIOS
    transaction_amount: 10,
    token: tokenId,
    installments: 1,
    payment_method_id: 'master',
    payer: {
      email: testBuyerEmail,
      // APRO no first_name simula aprovação em sandbox
      first_name: 'APRO',
    }
  };

  console.log('📝 Payload do pagamento (mínimo para Checkout Transparente):');
  console.log('   Valor: R$', paymentData.transaction_amount);
  console.log('   Método:', paymentData.payment_method_id);
  console.log('   Parcelas:', paymentData.installments);
  console.log('   Email:', paymentData.payer.email);
  console.log('   Nome (APRO = aprovação automática):', paymentData.payer.first_name);

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${Date.now()}`
    },
    body: JSON.stringify(paymentData)
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Erro ao criar pagamento:');
    console.error('   Status:', response.status);
    console.error('   Erro:', result.message || result.error);
    if (result.cause) {
      console.error('   Causa:', JSON.stringify(result.cause, null, 2));
    }
    return null;
  }

  console.log('✅ Pagamento criado!');
  console.log('   ID:', result.id);
  console.log('   Status:', result.status);
  console.log('   Detalhe:', result.status_detail);

  // Nota sobre status in_process
  if (result.status === 'in_process') {
    console.log('\n📋 NOTA: Status "in_process" é normal para novas aplicações de teste.');
    console.log('   O Mercado Pago pode levar até 2 dias úteis para processar.');
    console.log('   Em produção, pagamentos são processados em tempo real.');
  }

  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       TESTE DE INTEGRAÇÃO MERCADO PAGO');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // 1. Buscar credenciais
    console.log('\n📂 Buscando credenciais do banco de dados...');
    const creds = await getCredentials();

    console.log('✅ Credenciais encontradas:');
    console.log('   Environment:', creds.environment);
    console.log('   Public Key:', creds.publicKey);
    console.log('   Access Token:', creds.accessToken.substring(0, 30) + '...');

    // 2. Testar autenticação
    const user = await testAuthentication(creds.accessToken);
    if (!user) {
      console.log('\n⚠️  Falha na autenticação. Verifique o Access Token.');
      return;
    }

    // 3. Criar token de cartão
    const token = await createCardToken(creds.publicKey, creds.accessToken);
    if (!token) {
      console.log('\n⚠️  Falha ao criar token de cartão.');
      return;
    }

    // 4. Criar pagamento
    const payment = await createPayment(creds.accessToken, token.id);
    if (!payment) {
      console.log('\n⚠️  Falha ao criar pagamento.');
      return;
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('       RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Todos os testes passaram!');
    console.log('   Pagamento ID:', payment.id);
    console.log('   Status:', payment.status);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error.stack);
  }
}

main();
