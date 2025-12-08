/**
 * Cria um usuário de teste no Mercado Pago
 *
 * Para sandbox, o MP exige test users criados especificamente para sua aplicação.
 * Precisa usar credenciais de PRODUÇÃO para criar test users.
 */

import crypto from 'crypto';

// Token criptografado do banco (sandbox)
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

// Usa token de produção se disponível, senão usa o de teste
const PROD_TOKEN = process.env.MP_PROD_ACCESS_TOKEN;
const TEST_TOKEN = decrypt(ENCRYPTED_TOKEN);

async function main() {
  console.log('=== CRIAR USUÁRIO DE TESTE MP ===\n');

  // Para criar test users, precisa usar token de PRODUÇÃO
  // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts

  if (!PROD_TOKEN) {
    console.log('⚠️  Para criar usuários de teste, é necessário usar o Access Token de PRODUÇÃO.');
    console.log('');
    console.log('Passos:');
    console.log('1. Acesse: https://www.mercadopago.com.br/developers/panel/app/4013981001613751/credentials/production');
    console.log('2. Copie o Access Token de produção');
    console.log('3. Execute: MP_PROD_ACCESS_TOKEN="APP_USR-xxx" node scripts/create-mp-test-user.mjs');
    console.log('');
    console.log('Alternativa: Crie os test users pelo painel:');
    console.log('https://www.mercadopago.com.br/developers/panel/app/4013981001613751/test-accounts');
    return;
  }

  console.log('Usando token de produção para criar test user...');

  // Criar usuário de teste comprador
  const response = await fetch('https://api.mercadopago.com/users/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PROD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_id: 'MLB', // Brasil
      description: 'Test buyer for EnvioLegal',
    }),
  });

  const data = await response.json();

  console.log('HTTP Status:', response.status);

  if (response.ok) {
    console.log('\n✅ TEST USER CRIADO COM SUCESSO!');
    console.log('');
    console.log('ID:', data.id);
    console.log('Nickname:', data.nickname);
    console.log('Email:', data.email);
    console.log('Password:', data.password);
    console.log('');
    console.log('IMPORTANTE: Salve essas credenciais!');
    console.log('');
    console.log('Adicione no .env.local:');
    console.log(`MP_TEST_USER_EMAIL=${data.email}`);
  } else {
    console.log('\n❌ ERRO!');
    console.log('Message:', data.message);
    console.log('Response:', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
