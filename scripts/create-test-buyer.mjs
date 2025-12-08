/**
 * Criar test user comprador usando credenciais de sandbox
 *
 * Segundo a documentação do MP, é necessário ter duas contas:
 * - Seller (vendedor) - sua conta
 * - Buyer (comprador) - conta de teste para simular compras
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
  console.log('=== CRIAR TEST USER COMPRADOR ===\n');

  // Verificar se o test user antigo ainda existe
  console.log('1. Verificando test user antigo...');
  const oldEmail = 'test_user_80507629@testuser.com';

  // Tentar criar pagamento para ver o erro específico
  const testResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `test-check-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: 1,
      payment_method_id: 'pix',
      payer: { email: oldEmail },
    }),
  });

  const testData = await testResponse.json();
  console.log('Resposta PIX:', testResponse.status, testData.status || testData.message);
  console.log('');

  // Tentar criar novo test user
  console.log('2. Tentando criar novo test user...');

  const createResponse = await fetch('https://api.mercadopago.com/users/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_id: 'MLB',
      description: 'Comprador teste EnvioLegal',
    }),
  });

  const createData = await createResponse.json();

  console.log('HTTP:', createResponse.status);

  if (createResponse.ok) {
    console.log('\n✅ TEST USER CRIADO!');
    console.log('ID:', createData.id);
    console.log('Email:', createData.email);
    console.log('Nickname:', createData.nickname);
    console.log('Password:', createData.password);
    console.log('\nAdicione ao .env.local:');
    console.log(`MP_TEST_USER_EMAIL=${createData.email}`);
  } else {
    console.log('❌ Erro:', createData.message);
    console.log('Código:', createData.code);
    console.log('Detalhes:', JSON.stringify(createData, null, 2));

    if (createData.message?.includes('UNAUTHORIZED')) {
      console.log('\n⚠️  Para criar test users, pode ser necessário usar');
      console.log('   credenciais de PRODUÇÃO ao invés de sandbox.');
    }
  }

  // Tentar listar test users existentes
  console.log('\n3. Tentando listar test users existentes...');
  const listResponse = await fetch('https://api.mercadopago.com/users/test', {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });

  console.log('GET /users/test:', listResponse.status);
  if (listResponse.ok) {
    const listData = await listResponse.json();
    console.log('Test users:', JSON.stringify(listData, null, 2));
  }
}

main().catch(console.error);
