/**
 * Teste completo do fluxo de pagamento com cartão no Mercado Pago
 *
 * Usa cartão de teste oficial do MP:
 * - Mastercard: 5031 4332 1540 6351 (CVV: 123)
 * - Visa: 4509 9535 6623 3704 (CVV: 123)
 *
 * Uso: ACCESS_TOKEN="TEST-xxx" node scripts/test-mp-card-flow.mjs
 */

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('ACCESS_TOKEN não definido');
  console.log('Uso: ACCESS_TOKEN="TEST-xxx" node scripts/test-mp-card-flow.mjs');
  process.exit(1);
}

console.log('=== TESTE COMPLETO FLUXO CARTÃO MERCADO PAGO ===\n');
console.log('Access Token:', ACCESS_TOKEN.substring(0, 15) + '...');
console.log('');

// Cartão de teste Mastercard do MP Brasil
const TEST_CARD = {
  card_number: '5031433215406351',
  expiration_month: '11',
  expiration_year: '2030',
  security_code: '123',
  cardholder: {
    name: 'APRO', // Nome especial para aprovação automática em sandbox
    identification: {
      type: 'CPF',
      number: '12345678909',
    },
  },
};

async function createToken() {
  console.log('1. Criando token do cartão...');
  console.log('   Cartão:', TEST_CARD.card_number.substring(0, 6) + '******' + TEST_CARD.card_number.slice(-4));
  console.log('   Titular:', TEST_CARD.cardholder.name);

  const response = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(TEST_CARD),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('   ERRO ao criar token:', JSON.stringify(data, null, 2));
    throw new Error('Falha ao criar token');
  }

  console.log('   Token criado:', data.id);
  console.log('   First 6:', data.first_six_digits);
  console.log('   Last 4:', data.last_four_digits);
  console.log('');

  return data.id;
}

async function createPayment(token) {
  console.log('2. Criando pagamento...');

  const paymentData = {
    transaction_amount: 10.00,
    token: token,
    installments: 1,
    payment_method_id: 'master',
    payer: {
      email: 'test_user_123456789@testuser.com',
      first_name: 'APRO',
      identification: {
        type: 'CPF',
        number: '12345678909',
      },
    },
    description: 'Teste de pagamento',
  };

  console.log('   Payload:', JSON.stringify(paymentData, null, 2));
  console.log('');

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${Date.now()}`,
    },
    body: JSON.stringify(paymentData),
  });

  const data = await response.json();

  console.log('   HTTP Status:', response.status);
  console.log('   Response:', JSON.stringify(data, null, 2));
  console.log('');

  if (data.status === 'approved') {
    console.log('✅ PAGAMENTO APROVADO!');
    console.log('   ID:', data.id);
    console.log('   Status:', data.status);
    console.log('   Status Detail:', data.status_detail);
  } else if (data.status === 'rejected') {
    console.log('❌ PAGAMENTO REJEITADO!');
    console.log('   Status:', data.status);
    console.log('   Status Detail:', data.status_detail);
    console.log('');
    console.log('Possíveis causas:');
    console.log('- cc_rejected_bad_filled_card_number: número do cartão incorreto');
    console.log('- cc_rejected_bad_filled_date: data de expiração incorreta');
    console.log('- cc_rejected_bad_filled_security_code: CVV incorreto');
    console.log('- cc_rejected_call_for_authorize: usar nome CONT no titular');
    console.log('- cc_rejected_insufficient_amount: usar nome FUND no titular');
  } else if (data.error) {
    console.log('❌ ERRO!');
    console.log('   Message:', data.message);
    if (data.cause) {
      console.log('   Causes:', JSON.stringify(data.cause, null, 2));
    }
  } else {
    console.log('⚠️ STATUS:', data.status);
    console.log('   Detail:', data.status_detail);
  }

  return data;
}

async function main() {
  try {
    const token = await createToken();
    await createPayment(token);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

main();
