/**
 * Testa o token atual do banco de dados
 */

import crypto from 'crypto';

const ENCRYPTED_TOKEN = '4f403ff05f1af1e43ca7bbee870ee837:8bfa2d658650d407d000640e4ce809b3:ecb80f2ec535b2628a1057437b0215b54eacff58be6aa25e14cebec2ff414cfdbcd0c254988dcd32b5bb5b58295a3bdcf792f986752946b1b618e8f828bb51e6a5f6d7540d661626';
const ENCRYPTION_KEY = '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';

function decrypt(ciphertext) {
  const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return ciphertext;
  }

  const [ivHex, authTagHex, encrypted] = parts;

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    KEY_BUFFER,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function main() {
  console.log('=== TESTE TOKEN ATUAL DO BANCO ===\n');

  const accessToken = decrypt(ENCRYPTED_TOKEN);
  console.log('Access Token descriptografado:');
  console.log('  Prefix:', accessToken.substring(0, 25) + '...');
  console.log('  Length:', accessToken.length);
  console.log('');

  // Testar na API
  console.log('Testando na API do Mercado Pago...');

  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const data = await response.json();

  console.log('HTTP Status:', response.status);

  if (response.ok) {
    console.log('\n✅ TOKEN VÁLIDO!');
    console.log('User ID:', data.id);
    console.log('Email:', data.email);
    console.log('Nickname:', data.nickname);
    console.log('Site ID:', data.site_id);
  } else {
    console.log('\n❌ TOKEN INVÁLIDO!');
    console.log('Erro:', data.message);
    console.log('Código:', data.code);
    console.log('');
    console.log('AÇÃO NECESSÁRIA:');
    console.log('1. Acesse: https://www.mercadopago.com.br/developers/panel/app/' + accessToken.split('-')[1] + '/credentials');
    console.log('2. Gere novas credenciais de teste');
    console.log('3. Atualize em /admin/gateway-pagamento');
  }
}

main().catch(console.error);
