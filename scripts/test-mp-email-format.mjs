/**
 * Testa diferentes formatos de email para ver qual funciona
 */

import crypto from 'crypto';

const ENCRYPTED_TOKEN = '4f403ff05f1af1e43ca7bbee870ee837:8bfa2d658650d407d000640e4ce809b3:ecb80f2ec535b2628a1057437b0215b54eacff58be6aa25e14cebec2ff414cfdbcd0c254988dcd32b5bb5b58295a3bdcf792f986752946b1b618e8f828bb51e6a5f6d7540d661626';
const ENCRYPTION_KEY = '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';

function decrypt(ciphertext) {
  const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext;
  const [ivHex, authTagHex, encrypted] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

const ACCESS_TOKEN = decrypt(ENCRYPTED_TOKEN);

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
        identification: { type: 'CPF', number: '12345678909' },
      },
    }),
  });
  const data = await response.json();
  return data.id;
}

async function testPayment(email) {
  const token = await createToken();

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify({
      transaction_amount: 10.00,
      token,
      installments: 1,
      payment_method_id: 'master',
      payer: { email },
    }),
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function main() {
  console.log('=== TESTE DE FORMATOS DE EMAIL ===\n');

  const emails = [
    'test@test.com',
    'test_user_123456789@testuser.com',
    'TESTUSER123456789@testuser.com',
    'giovanetti@neoera.com.br', // Email real da conta
  ];

  for (const email of emails) {
    console.log(`Testando: ${email}`);
    const result = await testPayment(email);
    console.log(`  HTTP: ${result.status}`);
    if (result.data.status) {
      console.log(`  Status: ${result.data.status} (${result.data.status_detail || '-'})`);
    } else if (result.data.message) {
      console.log(`  Erro: ${result.data.message}`);
    }
    console.log('');
  }
}

main().catch(console.error);
