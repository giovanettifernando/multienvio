/**
 * Verifica status da aplicação no MP
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

// Extrair APP_ID do token (formato: TEST-APPID-DATE-HASH-USERID)
const tokenParts = ACCESS_TOKEN.split('-');
const APP_ID = tokenParts[1];

async function main() {
  console.log('=== STATUS DA APLICAÇÃO MP ===\n');
  console.log('APP_ID:', APP_ID);
  console.log('');

  // 1. Tentar buscar informações da aplicação
  const endpoints = [
    `/oauth/applications/${APP_ID}`,
    '/v1/account/release_report',
    '/v1/account/settlement_report',
  ];

  for (const endpoint of endpoints) {
    console.log(`Testando ${endpoint}:`);
    try {
      const response = await fetch(`https://api.mercadopago.com${endpoint}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
      });
      const data = await response.json();
      console.log('  HTTP:', response.status);
      if (response.ok) {
        console.log('  Data:', JSON.stringify(data, null, 2).substring(0, 500));
      } else {
        console.log('  Error:', data.message || JSON.stringify(data));
      }
    } catch (error) {
      console.log('  Erro:', error.message);
    }
    console.log('');
  }

  // 2. Testar se conseguimos criar um pagamento account_money (carteira MP)
  console.log('Testando criação de QR Code (alternativa):');
  try {
    const qrResponse = await fetch('https://api.mercadopago.com/instore/orders/qr/seller/collectors/2534937656/pos/test/qrs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_reference: 'test-123',
        title: 'Teste',
        description: 'Pagamento teste',
        total_amount: 10.00,
        items: [{ title: 'Item', unit_price: 10.00, quantity: 1 }],
      }),
    });
    const qrData = await qrResponse.json();
    console.log('  HTTP:', qrResponse.status);
    console.log('  Response:', JSON.stringify(qrData, null, 2));
  } catch (error) {
    console.log('  Erro:', error.message);
  }
}

main().catch(console.error);
