/**
 * Teste detalhado com headers e logging completo
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
const CORRECT_TEST_EMAIL = 'test_user_80507629@testuser.com';

async function main() {
  console.log('=== TESTE DETALHADO ===\n');

  // Criar token
  const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
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
  const tokenData = await tokenResponse.json();
  console.log('Token:', tokenData.id);
  console.log('');

  // Payload EXATAMENTE igual ao que funcionou antes
  const payload = {
    transaction_amount: 10,
    description: 'Recarga de carteira',  // Mesmo que funcionou
    payment_method_id: 'master',
    token: tokenData.id,
    installments: 1,
    payer: {
      email: CORRECT_TEST_EMAIL,
    },
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  // Requisição com todos os headers
  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${Date.now()}`,
      'User-Agent': 'MercadoPago SDK/2.0',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Log detalhado da resposta
  console.log('HTTP Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  console.log('');

  const text = await response.text();
  console.log('Response body:', text);

  try {
    const data = JSON.parse(text);
    if (data.status === 'approved') {
      console.log('\n✅ APROVADO!');
    } else {
      console.log('\n❌ Status:', data.status || data.message);
    }
  } catch (e) {
    console.log('(Não é JSON válido)');
  }
}

main().catch(console.error);
