/**
 * Script para testar pagamento usando API direta do Mercado Pago (sem SDK)
 * para identificar qual campo deve ser usado para associar à aplicação
 */

import crypto from 'crypto';
import pg from 'pg';
const { Client } = pg;

// Configuração de criptografia
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  const [ivHex, authTagHex, encrypted] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY_BUFFER,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getCredentials() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'envio',
    password: 'envio',
    database: 'enviolegal'
  });

  await client.connect();

  const result = await client.query(`
    SELECT pc."publicKey", pc."accessToken", pc."applicationId", pg.environment
    FROM payment_credentials pc
    JOIN payment_gateways pg ON pc."gatewayId" = pg.id
    WHERE pg.slug = 'mercadopago' AND pc."isActive" = true
  `);

  await client.end();

  const row = result.rows[0];
  return {
    publicKey: row.publicKey,
    accessToken: decrypt(row.accessToken),
    applicationId: row.applicationId,
    environment: row.environment
  };
}

async function createCardToken(publicKey) {
  console.log('\n🔐 Criando token de cartão...\n');

  const cardData = {
    card_number: '5031433215406351',
    expiration_month: '11',
    expiration_year: '2030',
    security_code: '123',
    cardholder: {
      name: 'APRO',
      identification: {
        type: 'CPF',
        number: '12345678909'
      }
    }
  };

  const response = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cardData)
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Erro ao criar token:', error);
    return null;
  }

  const token = await response.json();
  console.log('✅ Token criado:', token.id);
  return token;
}

async function createPaymentWithAPI(accessToken, applicationId, tokenId) {
  console.log('\n💳 Criando pagamento com API direta...\n');

  // Usar email de teste configurado ou fallback
  const testEmail = process.env.MP_TEST_USER_EMAIL || 'teste@exemplo.com';
  console.log('📧 Email do pagador:', testEmail);

  const paymentData = {
    transaction_amount: 10,
    token: tokenId,
    installments: 1,
    payment_method_id: 'master',
    payer: {
      email: testEmail,
      first_name: 'APRO',
      identification: {
        type: 'CPF',
        number: '12345678909'
      }
    },
    description: 'Teste de pagamento direto com API'
  };

  console.log('📝 Payload:', JSON.stringify(paymentData, null, 2));

  // Testar com diferentes headers para ver qual funciona
  console.log('\n🔍 Testando com headers diferentes...\n');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': `test-${Date.now()}`,
  };

  console.log('📤 Headers sendo enviados:');
  console.log(JSON.stringify(headers, null, 2));

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify(paymentData)
  });

  const result = await response.json();

  console.log('\n📥 Resposta da API:');
  console.log(JSON.stringify(result, null, 2));

  if (!response.ok) {
    console.error('❌ Erro ao criar pagamento');
    return null;
  }

  console.log('\n✅ Pagamento criado!');
  console.log('   ID:', result.id);
  console.log('   Status:', result.status);
  console.log('   Status Detail:', result.status_detail);

  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       TESTE DIRETO COM API MERCADO PAGO');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    const creds = await getCredentials();

    console.log('\n📂 Credenciais:');
    console.log('   Environment:', creds.environment);
    console.log('   Application ID:', creds.applicationId);
    console.log('   Public Key:', creds.publicKey);

    const token = await createCardToken(creds.publicKey);
    if (!token) return;

    const payment = await createPaymentWithAPI(
      creds.accessToken,
      creds.applicationId,
      token.id
    );

    if (payment) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('       TESTE CONCLUÍDO');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Payment ID:', payment.id);
      console.log('Use este ID para testar na ferramenta de qualidade do MP');
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error.stack);
  }
}

main();
