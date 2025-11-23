/**
 * Script para testar a API do Mercado Pago diretamente
 * Cria um token de cartão e depois um pagamento usando o SDK
 */

import { MercadoPagoConfig, Payment, CardToken } from 'mercadopago';

// Credenciais de teste
const ACCESS_TOKEN = 'APP_USR-2173989860016629-112114-4be0f475c015b3248dec30775c7f28ae-3007735624';

// Dados do cartão de teste do MP
const TEST_CARD = {
  cardNumber: '5031433215406351', // Mastercard de teste
  cardholderName: 'APRO', // Nome especial para aprovar pagamento
  cardExpirationMonth: '11',
  cardExpirationYear: '2030',
  securityCode: '123',
  identificationType: 'CPF',
  identificationNumber: '12345678909',
};

async function testMercadoPagoAPI() {
  console.log('========================================');
  console.log('TESTE DIRETO DA API DO MERCADO PAGO');
  console.log('========================================\n');

  try {
    // Criar cliente MP
    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
      options: {
        timeout: 30000,
        testToken: true, // Indicar que estamos usando credenciais de teste
      },
    });

    // Passo 1: Criar token de cartão usando SDK
    console.log('1. Criando token de cartão usando SDK...');
    console.log('   Access Token:', ACCESS_TOKEN.substring(0, 20) + '...');

    const cardToken = new CardToken(client);

    const tokenData = await cardToken.create({
      body: {
        card_number: TEST_CARD.cardNumber,
        expiration_month: TEST_CARD.cardExpirationMonth,
        expiration_year: TEST_CARD.cardExpirationYear,
        security_code: TEST_CARD.securityCode,
        cardholder: {
          name: TEST_CARD.cardholderName,
          identification: {
            type: TEST_CARD.identificationType,
            number: TEST_CARD.identificationNumber,
          },
        },
      },
    });

    console.log('✅ Token criado com sucesso!');
    console.log('   Token ID:', tokenData.id);
    console.log('   First 6:', tokenData.first_six_digits);
    console.log('   Last 4:', tokenData.last_four_digits);
    console.log();

    // Passo 2: Criar pagamento com o token
    console.log('2. Criando pagamento com o token...');
    console.log('   Token:', tokenData.id.substring(0, 20) + '...');

    const payment = new Payment(client);

    const paymentData = {
      transaction_amount: 1,
      description: 'Teste direto da API',
      payment_method_id: 'master',
      token: tokenData.id,
      installments: 1,
      payer: {
        email: 'test_user_3007735626@testuser.com', // Test user email
        first_name: 'Test',
        last_name: 'User',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
      additional_info: {
        payer: {
          first_name: 'Test',
          last_name: 'User',
        },
      },
    };

    console.log('   Payload:', JSON.stringify({
      ...paymentData,
      token: paymentData.token.substring(0, 20) + '...',
    }, null, 2));
    console.log();

    const paymentResponse = await payment.create({ body: paymentData });

    console.log('✅ PAGAMENTO CRIADO COM SUCESSO!');
    console.log('   Payment ID:', paymentResponse.id);
    console.log('   Status:', paymentResponse.status);
    console.log('   Status Detail:', paymentResponse.status_detail);
    console.log('   Amount:', paymentResponse.transaction_amount);
    console.log();
    console.log('========================================');
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('========================================');

  } catch (error: unknown) {
    console.error('\n❌ ERRO NO TESTE:');
    if (error && typeof error === 'object') {
      const err = error as { cause?: unknown[]; message?: string };
      if (err.cause && Array.isArray(err.cause)) {
        console.error('Detalhes do erro MP:', JSON.stringify(err.cause[0], null, 2));
      } else {
        console.error(err.message || 'Erro desconhecido');
      }
    } else {
      console.error(error);
    }
    console.log('========================================');
  }
}

testMercadoPagoAPI()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
