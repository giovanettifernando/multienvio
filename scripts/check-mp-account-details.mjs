/**
 * Verifica detalhes completos da conta MP para identificar bloqueios
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
  console.log('=== DETALHES COMPLETOS DA CONTA MP ===\n');

  // 1. Dados do usuário
  console.log('1. Dados do usuário (/users/me):');
  let userResponse = await fetch('https://api.mercadopago.com/users/me', {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });
  let userData = await userResponse.json();
  console.log(JSON.stringify(userData, null, 2));
  console.log('');

  // 2. Buscar último pagamento criado (se houver)
  console.log('2. Últimos pagamentos (/v1/payments/search):');
  let paymentsResponse = await fetch('https://api.mercadopago.com/v1/payments/search?limit=3', {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });
  let paymentsData = await paymentsResponse.json();
  console.log('HTTP:', paymentsResponse.status);
  if (paymentsResponse.ok && paymentsData.results) {
    console.log('Total de pagamentos:', paymentsData.paging?.total || 0);
    if (paymentsData.results.length > 0) {
      console.log('Último pagamento:', {
        id: paymentsData.results[0].id,
        status: paymentsData.results[0].status,
        date: paymentsData.results[0].date_created,
      });
    }
  } else {
    console.log('Erro:', paymentsData.message || JSON.stringify(paymentsData));
  }
  console.log('');

  // 3. Verificar se tem aplicação ativa
  console.log('3. Verificando tipo do token:');
  const tokenParts = ACCESS_TOKEN.split('-');
  console.log('  Tipo:', tokenParts[0]); // TEST ou APP_USR
  console.log('  APP_ID:', tokenParts[1]);
  console.log('  User ID:', tokenParts[tokenParts.length - 1]);
  console.log('');

  // 4. Tentar endpoint de verificação
  console.log('4. Verificando status da conta:');
  const statusResponse = await fetch(`https://api.mercadopago.com/v1/account/bank_report/config`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });
  console.log('  /v1/account/bank_report/config:', statusResponse.status);

  const balanceResponse = await fetch(`https://api.mercadopago.com/users/me/mercadopago_account/balance`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });
  console.log('  /users/me/mercadopago_account/balance:', balanceResponse.status);
  if (balanceResponse.ok) {
    const balanceData = await balanceResponse.json();
    console.log('  Saldo:', JSON.stringify(balanceData, null, 2));
  }
}

main().catch(console.error);
