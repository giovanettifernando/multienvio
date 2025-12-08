/**
 * Verifica informações detalhadas da conta MP e suas permissões
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

async function fetchApi(endpoint) {
  const response = await fetch(`https://api.mercadopago.com${endpoint}`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });
  return { status: response.status, data: await response.json() };
}

async function main() {
  console.log('=== INFORMAÇÕES DA CONTA MP ===\n');

  // 1. Info básica
  console.log('1. Dados do usuário:');
  const user = await fetchApi('/users/me');
  if (user.status === 200) {
    console.log('   ID:', user.data.id);
    console.log('   Email:', user.data.email);
    console.log('   Site:', user.data.site_id);
    console.log('   Status:', user.data.status?.site_status);
    console.log('   Identificação:', user.data.identification?.type, user.data.identification?.number);
  }
  console.log('');

  // 2. Métodos de pagamento disponíveis
  console.log('2. Métodos de pagamento disponíveis:');
  const methods = await fetchApi('/v1/payment_methods');
  if (methods.status === 200 && Array.isArray(methods.data)) {
    const cards = methods.data.filter(m => m.payment_type_id === 'credit_card' || m.payment_type_id === 'debit_card');
    console.log('   Cartões:', cards.map(c => c.id).join(', '));
    const pix = methods.data.find(m => m.id === 'pix');
    console.log('   PIX:', pix ? 'Disponível' : 'Não disponível');
  }
  console.log('');

  // 3. Teste com PIX (não precisa de cartão)
  console.log('3. Testando criação de pagamento PIX:');
  const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pix-test-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: 10.00,
      payment_method_id: 'pix',
      payer: {
        email: 'test@test.com',
      },
    }),
  });
  const pixData = await pixResponse.json();
  console.log('   HTTP:', pixResponse.status);
  if (pixResponse.ok) {
    console.log('   ✅ PIX criado! ID:', pixData.id);
    console.log('   Status:', pixData.status);
    console.log('   QR Code disponível:', !!pixData.point_of_interaction?.transaction_data?.qr_code);
  } else {
    console.log('   ❌ Erro:', pixData.message);
    if (pixData.cause?.length) {
      console.log('   Cause:', JSON.stringify(pixData.cause, null, 2));
    }
  }
  console.log('');

  // 4. Verificar se precisa criar test users
  console.log('4. Verificando test users:');
  const testUsers = await fetchApi('/users/test');
  console.log('   HTTP:', testUsers.status);
  if (testUsers.status === 200) {
    console.log('   Test users disponíveis:', JSON.stringify(testUsers.data, null, 2));
  } else {
    console.log('   Não foi possível listar test users');
    console.log('   Mensagem:', testUsers.data?.message);
  }
}

main().catch(console.error);
