import { MercadoPagoConfig, Payment, CardToken } from 'mercadopago';
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
const TEST_BUYER_EMAIL = 'test_user_1418665125493192743@testuser.com';

async function main() {
  console.log('=== TESTE DE PAGAMENTO ===\n');

  const client = new MercadoPagoConfig({
    accessToken: ACCESS_TOKEN,
    options: { timeout: 30000 },
  });

  // 1. Criar token
  console.log('1. Criando token...');
  const cardToken = new CardToken(client);
  const tokenData = await cardToken.create({
    body: {
      card_number: '5031433215406351',
      expiration_month: '11',
      expiration_year: '2030',
      security_code: '123',
      cardholder: {
        name: 'APRO',
        identification: { type: 'CPF', number: '12345678909' },
      },
    },
  });
  console.log('✅ Token:', tokenData.id);

  // 2. Criar pagamento
  console.log('\n2. Criando pagamento...');
  const payment = new Payment(client);
  const result = await payment.create({
    body: {
      transaction_amount: 10,
      description: 'Teste de recarga',
      payment_method_id: 'master',
      token: tokenData.id,
      installments: 1,
      payer: {
        email: TEST_BUYER_EMAIL,
      },
    },
  });

  console.log('\n=== RESULTADO ===');
  console.log('ID:', result.id);
  console.log('Status:', result.status);
  console.log('Status Detail:', result.status_detail);
  
  if (result.status === 'approved') {
    console.log('\n✅ PAGAMENTO APROVADO! Crédito seria aplicado.');
  } else {
    console.log('\n⚠️ Status:', result.status, '- Aguardando webhook');
  }
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  if (err.cause) console.error('Cause:', JSON.stringify(err.cause, null, 2));
});
