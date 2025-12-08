/**
 * Teste direto da API do Mercado Pago (sem SDK)
 *
 * Uso: ACCESS_TOKEN="TEST-xxx" node scripts/test-mp-direct.mjs
 * Ou pegue o token do banco via:
 *   node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.paymentCredential.findFirst({where:{isActive:true}}).then(c=>console.log(c.accessToken)).finally(()=>p.\$disconnect())"
 */

import crypto from 'crypto';

// Função de descriptografia (copiada do encryption.service.ts)
function decrypt(ciphertext) {
  if (!ciphertext) return '';

  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY não definida');
  }

  const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    // Assume it's not encrypted
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

function getAccessToken() {
  // Primeiro tenta ACCESS_TOKEN direto
  if (process.env.ACCESS_TOKEN) {
    return process.env.ACCESS_TOKEN;
  }

  // Depois tenta MP_ACCESS_TOKEN
  if (process.env.MP_ACCESS_TOKEN) {
    return process.env.MP_ACCESS_TOKEN;
  }

  // Se tiver ENCRYPTED_TOKEN, descriptografa
  if (process.env.ENCRYPTED_TOKEN) {
    return decrypt(process.env.ENCRYPTED_TOKEN);
  }

  return null;
}

async function testDirectAPI() {
  console.log('=== TESTE DIRETO API MERCADO PAGO ===\n');

  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error('Access Token não encontrado!');
    process.exit(1);
  }

  console.log('Access Token:', accessToken.substring(0, 15) + '...');
  console.log('Length:', accessToken.length);
  console.log('');

  // Payload mínimo para teste
  const payload = {
    transaction_amount: 10,
    payment_method_id: 'pix', // PIX não precisa de token de cartão
    payer: {
      email: 'test@test.com',
    },
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('Status HTTP:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCESSO! Pagamento criado.');
    } else {
      console.log('\n❌ ERRO!');
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
  }
}

testDirectAPI();
