/**
 * Teste MÍNIMO de pagamento com cartão no Mercado Pago
 * Tenta identificar o campo que causa o internal_error
 */

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('ACCESS_TOKEN não definido');
  process.exit(1);
}

console.log('=== TESTE MÍNIMO MERCADO PAGO ===\n');

async function createToken() {
  const response = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      card_number: '5031433215406351',
      expiration_month: '11',
      expiration_year: '2030',
      security_code: '123',
      cardholder: {
        name: 'APRO',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error('Token failed: ' + JSON.stringify(data));
  console.log('Token:', data.id);
  return data.id;
}

async function testPayment(token, config) {
  console.log('\nTestando:', config.name);

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify(config.payload),
  });

  const data = await response.json();
  console.log('  HTTP:', response.status);

  if (data.status === 'approved') {
    console.log('  ✅ APROVADO! ID:', data.id);
  } else if (data.status === 'rejected') {
    console.log('  ❌ REJEITADO:', data.status_detail);
  } else if (data.message) {
    console.log('  ⚠️ ERRO:', data.message);
    if (data.cause?.length) {
      console.log('  Cause:', JSON.stringify(data.cause));
    }
  }

  return data;
}

async function main() {
  const token = await createToken();

  // Teste 1: Payload absolutamente mínimo
  await testPayment(token, {
    name: 'Mínimo absoluto (email qualquer)',
    payload: {
      transaction_amount: 10,
      token: token,
      installments: 1,
      payment_method_id: 'master',
      payer: { email: 'random@email.com' },
    },
  });

  // Novo token para próximo teste
  const token2 = await createToken();

  // Teste 2: Com email no formato test_user
  await testPayment(token2, {
    name: 'Email formato test_user',
    payload: {
      transaction_amount: 10,
      token: token2,
      installments: 1,
      payment_method_id: 'master',
      payer: { email: 'test_user_2534937656@testuser.com' },
    },
  });

  // Novo token
  const token3 = await createToken();

  // Teste 3: Sem payment_method_id (MP infere do token)
  await testPayment(token3, {
    name: 'Sem payment_method_id',
    payload: {
      transaction_amount: 10,
      token: token3,
      installments: 1,
      payer: { email: 'test@test.com' },
    },
  });

  // Novo token
  const token4 = await createToken();

  // Teste 4: Com descrição e first_name APRO
  await testPayment(token4, {
    name: 'Com description e first_name APRO',
    payload: {
      transaction_amount: 10,
      token: token4,
      installments: 1,
      payment_method_id: 'master',
      description: 'Teste',
      payer: {
        email: 'test@test.com',
        first_name: 'APRO',
      },
    },
  });
}

main().catch(console.error);
