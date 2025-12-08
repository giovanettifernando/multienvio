/**
 * Buscar email do test user recém criado
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
  console.log('=== CRIAR E VERIFICAR TEST USER ===\n');

  // Criar novo test user e mostrar resposta completa
  console.log('Criando test user...');

  const createResponse = await fetch('https://api.mercadopago.com/users/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_id: 'MLB',
      description: 'Comprador teste',
    }),
  });

  const createData = await createResponse.json();

  console.log('Status:', createResponse.status);
  console.log('Resposta COMPLETA:');
  console.log(JSON.stringify(createData, null, 2));

  if (createData.id) {
    // O email do test user segue o padrão: test_user_{id}@testuser.com
    const testEmail = `test_user_${createData.id}@testuser.com`;
    console.log('\n✅ Email do test user:', testEmail);

    // Testar pagamento com esse email
    console.log('\nTestando pagamento com novo test user...');

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

    // Criar pagamento
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `test-new-user-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: 10,
        description: 'Teste com novo test user',
        payment_method_id: 'master',
        token: tokenData.id,
        installments: 1,
        payer: { email: testEmail },
      }),
    });

    const paymentData = await paymentResponse.json();

    console.log('HTTP:', paymentResponse.status);
    if (paymentData.status === 'approved') {
      console.log('✅ PAGAMENTO APROVADO! ID:', paymentData.id);
    } else {
      console.log('Resultado:', paymentData.status || paymentData.message);
    }
  }
}

main().catch(console.error);
