/**
 * Testa criação de preferência (Checkout Pro) ao invés de pagamento direto
 * O Checkout Pro redireciona para o MP e pode funcionar mesmo sem configuração completa
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

async function main() {
  console.log('=== TESTE CHECKOUT PRO (PREFERENCE) ===\n');

  // Criar uma preferência
  const preference = {
    items: [
      {
        title: 'Teste de produto',
        quantity: 1,
        unit_price: 10.00,
        currency_id: 'BRL',
      },
    ],
    payer: {
      email: 'test@test.com',
    },
    back_urls: {
      success: 'https://example.com/success',
      failure: 'https://example.com/failure',
      pending: 'https://example.com/pending',
    },
    auto_return: 'approved',
    external_reference: 'test-123',
  };

  console.log('Criando preferência...');
  console.log('Payload:', JSON.stringify(preference, null, 2));
  console.log('');

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  const data = await response.json();

  console.log('HTTP Status:', response.status);
  console.log('');

  if (response.ok) {
    console.log('✅ PREFERÊNCIA CRIADA COM SUCESSO!');
    console.log('');
    console.log('ID:', data.id);
    console.log('Init Point (produção):', data.init_point);
    console.log('Sandbox Init Point:', data.sandbox_init_point);
    console.log('');
    console.log('Isso significa que o Checkout Pro funciona!');
    console.log('O Checkout API (Transparente) pode precisar de configuração adicional.');
  } else {
    console.log('❌ ERRO!');
    console.log('Message:', data.message);
    if (data.cause) {
      console.log('Cause:', JSON.stringify(data.cause, null, 2));
    }
    console.log('');
    console.log('Resposta completa:', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
