/**
 * Verifica os últimos pagamentos criados para entender o formato que funcionou
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
  console.log('=== ÚLTIMOS PAGAMENTOS ===\n');

  const response = await fetch('https://api.mercadopago.com/v1/payments/search?limit=5&sort=date_created&criteria=desc', {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });

  const data = await response.json();

  if (!response.ok) {
    console.log('Erro:', data.message);
    return;
  }

  console.log(`Total de pagamentos: ${data.paging.total}\n`);

  for (const payment of data.results) {
    console.log('-------------------');
    console.log('ID:', payment.id);
    console.log('Data:', payment.date_created);
    console.log('Status:', payment.status, '-', payment.status_detail);
    console.log('Valor:', payment.transaction_amount);
    console.log('Método:', payment.payment_method_id, '/', payment.payment_type_id);
    console.log('Payer email:', payment.payer?.email);
    console.log('Payer name:', payment.payer?.first_name, payment.payer?.last_name);
    console.log('Description:', payment.description);
    console.log('');
  }
}

main().catch(console.error);
