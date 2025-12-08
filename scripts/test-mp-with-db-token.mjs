/**
 * Teste de pagamento usando token do banco de dados
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

async function main() {
  console.log('=== TESTE PAGAMENTO COM TOKEN DO BANCO ===\n');

  const ACCESS_TOKEN = decrypt(ENCRYPTED_TOKEN);
  console.log('Token:', ACCESS_TOKEN.substring(0, 25) + '...');
  console.log('');

  // 1. Criar token do cartão de teste
  console.log('1. Criando token do cartão...');

  const cardResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      card_number: '5031433215406351', // Mastercard de teste
      expiration_month: '11',
      expiration_year: '2030',
      security_code: '123',
      cardholder: {
        name: 'APRO', // Nome especial para aprovação automática
        identification: { type: 'CPF', number: '12345678909' },
      },
    }),
  });

  const cardData = await cardResponse.json();

  if (!cardResponse.ok) {
    console.log('❌ Erro ao criar token:', cardData.message);
    return;
  }

  console.log('✅ Token criado:', cardData.id);
  console.log('   First 6:', cardData.first_six_digits);
  console.log('   Last 4:', cardData.last_four_digits);
  console.log('');

  // 2. Criar pagamento
  console.log('2. Criando pagamento...');

  const paymentPayload = {
    transaction_amount: 10.00,
    token: cardData.id,
    installments: 1,
    payment_method_id: 'master',
    payer: {
      email: 'test@test.com',
      first_name: 'APRO',
    },
    description: 'Teste de pagamento',
  };

  console.log('   Payload:', JSON.stringify(paymentPayload, null, 2));
  console.log('');

  const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-${Date.now()}`,
    },
    body: JSON.stringify(paymentPayload),
  });

  const paymentData = await paymentResponse.json();

  console.log('   HTTP Status:', paymentResponse.status);
  console.log('   Response:', JSON.stringify(paymentData, null, 2));
  console.log('');

  if (paymentData.status === 'approved') {
    console.log('✅ PAGAMENTO APROVADO!');
    console.log('   ID:', paymentData.id);
  } else if (paymentData.status === 'rejected') {
    console.log('❌ PAGAMENTO REJEITADO!');
    console.log('   Status detail:', paymentData.status_detail);
    console.log('');
    console.log('Diagnóstico:');
    if (paymentData.status_detail.includes('bad_filled')) {
      console.log('   - Dados do cartão incorretos');
    } else if (paymentData.status_detail.includes('insufficient')) {
      console.log('   - Use nome "FUND" para simular falta de fundos');
    } else if (paymentData.status_detail.includes('call_for_authorize')) {
      console.log('   - Cartão requer autorização adicional');
    }
  } else if (paymentData.message) {
    console.log('❌ ERRO:', paymentData.message);
    if (paymentData.cause) {
      console.log('   Cause:', JSON.stringify(paymentData.cause, null, 2));
    }
  } else {
    console.log('⚠️ Status:', paymentData.status);
    console.log('   Detail:', paymentData.status_detail);
  }
}

main().catch(console.error);
