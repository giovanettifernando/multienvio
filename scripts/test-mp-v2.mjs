/**
 * Teste do Mercado Pago usando SDK oficial v2
 * Baseado nas instruções do vídeo de integração
 *
 * Cartões de Teste (Brasil):
 * - Mastercard: 5031 4332 1540 6351 | CVV: 123 | Exp: 11/30
 * - Visa: 4235 6477 2802 5682 | CVV: 123 | Exp: 11/30
 *
 * Status (usar no nome do titular):
 * - APRO = Aprovado
 * - OTHE = Recusado erro geral
 * - CONT = Pendente
 * - FUND = Saldo insuficiente
 */

import { MercadoPagoConfig, Payment, CardToken } from 'mercadopago';
import crypto from 'crypto';
import pg from 'pg';
const { Client } = pg;

// ============================================
// CRIPTOGRAFIA
// ============================================
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = '824cee9bccecff10b828ad3ae52340c62162e2c1aefd07861640a62835420ac3';
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, authTagHex, encrypted] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============================================
// BUSCAR CREDENCIAIS DO BANCO
// ============================================
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

  if (result.rows.length === 0) {
    throw new Error('Credenciais não encontradas');
  }

  const row = result.rows[0];
  return {
    publicKey: row.publicKey,
    accessToken: decrypt(row.accessToken),
    applicationId: row.applicationId,
    environment: row.environment
  };
}

// ============================================
// TESTE COM SDK v2
// ============================================
async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('  TESTE MERCADO PAGO - SDK v2');
  console.log('='.repeat(60));

  try {
    // 1. Buscar credenciais
    console.log('\n[1/4] Buscando credenciais...');
    const creds = await getCredentials();
    console.log('  ✓ Ambiente:', creds.environment);
    console.log('  ✓ Public Key:', creds.publicKey.substring(0, 30) + '...');
    console.log('  ✓ Access Token:', creds.accessToken.substring(0, 30) + '...');

    // 2. Configurar SDK
    console.log('\n[2/4] Configurando SDK...');
    const client = new MercadoPagoConfig({
      accessToken: creds.accessToken,
      options: { timeout: 30000 }
    });
    console.log('  ✓ SDK configurado');

    // 3. Criar token do cartão
    // Conforme documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
    console.log('\n[3/4] Criando token do cartão...');
    const cardToken = new CardToken(client);

    // Dados do cartão de teste oficial do Mercado Pago Brasil
    const cardData = {
      card_number: '4235647728025682',      // VISA teste Brasil
      expiration_month: '11',
      expiration_year: '2030',
      security_code: '123',
      cardholder: {
        name: 'APRO',                        // APRO = simula aprovação
        identification: {
          type: 'CPF',
          number: '12345678909'              // CPF de teste válido
        }
      }
    };

    console.log('  Cartão:', {
      numero: cardData.card_number,
      titular: cardData.cardholder.name,
      cpf: cardData.cardholder.identification.number
    });

    const tokenResponse = await cardToken.create({ body: cardData });

    console.log('  ✓ Token criado:', tokenResponse.id);
    console.log('  ✓ Primeiros 6:', tokenResponse.first_six_digits);
    console.log('  ✓ Últimos 4:', tokenResponse.last_four_digits);

    // 4. Criar pagamento
    // Conforme documentação do Checkout Transparente
    console.log('\n[4/4] Criando pagamento...');
    const payment = new Payment(client);

    // Payload conforme documentação oficial
    const paymentData = {
      transaction_amount: 100,               // Valor em reais
      token: tokenResponse.id,               // Token gerado no passo anterior
      description: 'Descrição do produto',   // Descrição do pagamento
      installments: 1,                       // Número de parcelas
      payment_method_id: 'visa',             // Bandeira do cartão
      payer: {
        email: 'test@test.com',                  // Email qualquer válido
        first_name: 'APRO',                      // Nome (APRO = aprovação)
        last_name: 'User',
        identification: {
          type: 'CPF',
          number: '12345678909'
        }
      }
    };

    console.log('  Payload:', JSON.stringify(paymentData, null, 2));

    const paymentResponse = await payment.create({
      body: paymentData,
      requestOptions: {
        idempotencyKey: `test-sdk-v2-${Date.now()}`
      }
    });

    // 5. Resultado
    console.log('\n' + '-'.repeat(60));
    console.log('  RESULTADO');
    console.log('-'.repeat(60));
    console.log('  ID:', paymentResponse.id);
    console.log('  Status:', paymentResponse.status);
    console.log('  Status Detail:', paymentResponse.status_detail);
    console.log('  Integrator ID:', paymentResponse.integrator_id || 'N/A');
    console.log('  Platform ID:', paymentResponse.platform_id || 'N/A');

    if (paymentResponse.status === 'approved') {
      console.log('\n  ✅ PAGAMENTO APROVADO!');
    } else if (paymentResponse.status === 'in_process') {
      console.log('\n  ⏳ PAGAMENTO EM PROCESSAMENTO');
      console.log('  Detalhe:', paymentResponse.status_detail);
    } else if (paymentResponse.status === 'rejected') {
      console.log('\n  ❌ PAGAMENTO REJEITADO');
      console.log('  Motivo:', paymentResponse.status_detail);
    }

    console.log('-'.repeat(60));

    return paymentResponse;

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.cause) {
      console.error('Causa:', JSON.stringify(error.cause, null, 2));
    }
    throw error;
  }
}

// Executar
runTest()
  .then(result => {
    console.log('\n✓ Teste concluído. Payment ID:', result.id);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Teste falhou:', error.message);
    process.exit(1);
  });
