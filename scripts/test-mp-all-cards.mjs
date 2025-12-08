/**
 * Teste com todos os cartões de teste do MP
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
const TEST_EMAIL = 'test_user_80507629@testuser.com';

const CARDS = [
  { name: 'Mastercard', number: '5031433215406351', cvv: '123', method: 'master' },
  { name: 'Visa', number: '4235647728025682', cvv: '123', method: 'visa' },
  { name: 'American Express', number: '375365153556885', cvv: '1234', method: 'amex' },
  { name: 'Elo Debito', number: '5067766783888311', cvv: '123', method: 'elo' },
];

async function testCard(card) {
  console.log(`\n--- Testando ${card.name} ---`);

  // 1. Criar token
  const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      card_number: card.number,
      expiration_month: '11',
      expiration_year: '2030',
      security_code: card.cvv,
      cardholder: {
        name: 'APRO',
        identification: { type: 'CPF', number: '12345678909' },
      },
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.log('❌ Erro ao criar token:', tokenData.message || JSON.stringify(tokenData));
    return;
  }

  console.log('Token:', tokenData.id);

  // 2. Criar pagamento
  const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${card.method}-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: 10,
      description: 'Teste',
      payment_method_id: card.method,
      token: tokenData.id,
      installments: 1,
      payer: { email: TEST_EMAIL },
    }),
  });

  const paymentData = await paymentResponse.json();

  if (paymentData.status === 'approved') {
    console.log('✅ APROVADO! ID:', paymentData.id);
  } else if (paymentData.status === 'rejected') {
    console.log('❌ Rejeitado:', paymentData.status_detail);
  } else {
    console.log('HTTP:', paymentResponse.status, '- Erro:', paymentData.message || paymentData.status);
  }
}

async function main() {
  console.log('=== TESTE TODOS OS CARTÕES ===');

  for (const card of CARDS) {
    await testCard(card);
  }
}

main().catch(console.error);
