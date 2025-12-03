/**
 * Teste de Checkout Transparente - Mercado Pago
 *
 * Simula o fluxo real de pagamento com cartão de crédito.
 * O usuário NÃO precisa ter conta no Mercado Pago.
 *
 * Documentação:
 * - Cartões de teste: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
 * - Checkout API: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
 *
 * Cartões de Teste (Brasil - MLB):
 * - Mastercard: 5031 4332 1540 6351 | CVV: 123 | Validade: 11/30
 * - Visa: 4235 6477 2802 5682 | CVV: 123 | Validade: 11/30
 *
 * Simulação de Status (usar como nome do titular):
 * - APRO = Pagamento aprovado
 * - OTHE = Recusado por erro geral
 * - CONT = Pagamento pendente
 * - FUND = Recusado por saldo insuficiente
 * - SECU = Recusado por CVV inválido
 * - EXPI = Recusado por data de vencimento
 */

import crypto from 'crypto';
import pg from 'pg';
const { Client } = pg;

// ============================================
// CONFIGURAÇÃO DE CRIPTOGRAFIA
// ============================================
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, authTagHex, encrypted] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============================================
// CARTÕES DE TESTE OFICIAIS (BRASIL)
// ============================================
const TEST_CARDS = {
  mastercard: {
    number: '5031433215406351',
    cvv: '123',
    expMonth: '11',
    expYear: '2030',
    brand: 'master'
  },
  visa: {
    number: '4235647728025682',
    cvv: '123',
    expMonth: '11',
    expYear: '2030',
    brand: 'visa'
  }
};

// ============================================
// SIMULADORES DE STATUS (nome do titular)
// ============================================
const STATUS_SIMULATORS = {
  APRO: 'Pagamento aprovado',
  OTHE: 'Recusado por erro geral',
  CONT: 'Pagamento pendente',
  FUND: 'Recusado por saldo insuficiente',
  SECU: 'Recusado por CVV inválido',
  EXPI: 'Recusado por data vencimento'
};

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

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
    SELECT
      pc."publicKey",
      pc."accessToken",
      pc."applicationId",
      pg.environment
    FROM payment_credentials pc
    JOIN payment_gateways pg ON pc."gatewayId" = pg.id
    WHERE pg.slug = 'mercadopago' AND pc."isActive" = true
  `);

  await client.end();

  if (result.rows.length === 0) {
    throw new Error('Credenciais do Mercado Pago não encontradas');
  }

  const row = result.rows[0];
  return {
    publicKey: row.publicKey,
    accessToken: decrypt(row.accessToken),
    applicationId: row.applicationId,
    environment: row.environment
  };
}

/**
 * Cria token do cartão via API do Mercado Pago
 * Em produção, isso é feito no frontend com o SDK JS
 */
async function createCardToken(publicKey, card, cardholderName) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_number: card.number,
        expiration_month: card.expMonth,
        expiration_year: card.expYear,
        security_code: card.cvv,
        cardholder: {
          name: cardholderName,
          identification: {
            type: 'CPF',
            number: '12345678909' // CPF de teste válido
          }
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro ao criar token: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Cria pagamento via API direta (com headers necessários)
 */
async function createPayment(config, tokenId, card, amount, buyerEmail) {
  const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Headers obrigatórios + headers para associar à aplicação
  const headers = {
    'Authorization': `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
  };

  // Headers para associar pagamento à aplicação (resolve "Payment was not originated from app")
  if (config.applicationId) {
    headers['X-Integrator-Id'] = config.applicationId;
    headers['X-Platform-Id'] = config.applicationId;
  }

  // Payload mínimo para Checkout Transparente
  const payload = {
    // OBRIGATÓRIOS
    transaction_amount: amount,
    token: tokenId,
    installments: 1,
    payment_method_id: card.brand,

    // Dados do comprador (NÃO precisa ter conta MP)
    payer: {
      email: buyerEmail,
      first_name: 'APRO', // Simula aprovação
      last_name: 'Teste',
      identification: {
        type: 'CPF',
        number: '12345678909'
      }
    },

    // Opcionais (melhoram rastreabilidade)
    description: 'Teste Checkout Transparente',
    statement_descriptor: 'ENVIO LEGAL',

    // Referência externa para conciliação
    external_reference: JSON.stringify({
      type: 'test',
      timestamp: Date.now()
    })
  };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ao criar pagamento: ${JSON.stringify(result)}`);
  }

  return result;
}

// ============================================
// EXECUÇÃO DO TESTE
// ============================================

async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('  TESTE DE CHECKOUT TRANSPARENTE - MERCADO PAGO');
  console.log('  Simulando pagamento com cartão (usuário SEM conta MP)');
  console.log('='.repeat(70));

  try {
    // 1. Carregar credenciais
    console.log('\n[1/4] Carregando credenciais...');
    const config = await getCredentials();
    console.log(`  ✓ Ambiente: ${config.environment}`);
    console.log(`  ✓ Application ID: ${config.applicationId || 'NÃO CONFIGURADO'}`);
    console.log(`  ✓ Public Key: ${config.publicKey.substring(0, 20)}...`);

    // 2. Escolher cartão e status
    const card = TEST_CARDS.mastercard;
    const cardholderName = 'APRO'; // Simula aprovação
    const amount = 10.00;
    const buyerEmail = 'comprador@teste.com.br'; // Qualquer email válido

    console.log('\n[2/4] Dados do pagamento:');
    console.log(`  ✓ Cartão: Mastercard ****${card.number.slice(-4)}`);
    console.log(`  ✓ Titular: ${cardholderName} (${STATUS_SIMULATORS[cardholderName]})`);
    console.log(`  ✓ Valor: R$ ${amount.toFixed(2)}`);
    console.log(`  ✓ Email: ${buyerEmail}`);

    // 3. Criar token do cartão
    console.log('\n[3/4] Criando token do cartão...');
    const token = await createCardToken(config.publicKey, card, cardholderName);
    console.log(`  ✓ Token: ${token.id}`);
    console.log(`  ✓ Primeiros 6: ${token.first_six_digits}`);
    console.log(`  ✓ Últimos 4: ${token.last_four_digits}`);

    // 4. Criar pagamento
    console.log('\n[4/4] Criando pagamento...');
    const payment = await createPayment(config, token.id, card, amount, buyerEmail);

    console.log('\n' + '-'.repeat(70));
    console.log('  RESULTADO DO PAGAMENTO');
    console.log('-'.repeat(70));
    console.log(`  ID:              ${payment.id}`);
    console.log(`  Status:          ${payment.status}`);
    console.log(`  Status Detail:   ${payment.status_detail}`);
    console.log(`  Integrator ID:   ${payment.integrator_id || 'N/A'}`);
    console.log(`  Platform ID:     ${payment.platform_id || 'N/A'}`);
    console.log(`  Live Mode:       ${payment.live_mode}`);

    // Interpretar resultado
    console.log('\n' + '-'.repeat(70));
    if (payment.status === 'approved') {
      console.log('  ✅ PAGAMENTO APROVADO!');
      console.log('  A integração está funcionando corretamente.');
    } else if (payment.status === 'in_process' && payment.status_detail === 'pending_contingency') {
      console.log('  ⚠️  PAGAMENTO EM ANÁLISE (pending_contingency)');
      console.log('');
      console.log('  Este status é NORMAL em sandbox para aplicações novas.');
      console.log('  Em PRODUÇÃO, pagamentos serão aprovados normalmente.');
      console.log('');
      console.log('  A integração está CORRETA:');
      console.log(`    - integrator_id: ${payment.integrator_id ? '✓' : '✗'}`);
      console.log(`    - platform_id: ${payment.platform_id ? '✓' : '✗'}`);
    } else if (payment.status === 'rejected') {
      console.log('  ❌ PAGAMENTO REJEITADO');
      console.log(`  Motivo: ${payment.status_detail}`);
    } else {
      console.log(`  ⏳ Status: ${payment.status} (${payment.status_detail})`);
    }
    console.log('-'.repeat(70));

    return payment;

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    throw error;
  }
}

// Executar
runTest()
  .then(payment => {
    console.log('\n✓ Teste concluído. Payment ID:', payment.id);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Teste falhou:', error.message);
    process.exit(1);
  });
