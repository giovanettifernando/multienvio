/**
 * Script para testar o fluxo completo de pagamento
 *
 * Este script:
 * 1. Busca as credenciais descriptografadas do banco (como o sistema faz)
 * 2. Cria um token de cartão usando cartão de teste do MP
 * 3. Cria um pagamento
 * 4. Verifica o status
 * 5. Se aprovado, credita a carteira
 */

import { prisma } from '@/platform/db/db';
import { decrypt } from '@/lib/integrations/shared/encryption.service';
import { MercadoPagoConfig, Payment, CardToken } from 'mercadopago';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';

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

async function testCompleteFlow() {
  console.log('========================================');
  console.log('TESTE COMPLETO DE PAGAMENTO');
  console.log('========================================\n');

  try {
    // 1. Buscar credenciais descriptografadas do banco
    console.log('1. Buscando credenciais do banco...');

    const gateway = await prisma.paymentGateway.findFirst({
      where: {
        slug: 'mercadopago',
        status: 'ACTIVE',
      },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!gateway || gateway.credentials.length === 0) {
      throw new Error('Gateway ou credenciais não encontrados');
    }

    const credential = gateway.credentials[0];
    const publicKey = credential.publicKey || '';
    const accessToken = credential.accessToken ? decrypt(credential.accessToken) : '';

    console.log('   ✅ Credenciais encontradas:');
    console.log('   Public Key:', publicKey.substring(0, 30) + '...');
    console.log('   Access Token:', accessToken.substring(0, 30) + '...');
    console.log('   Environment:', gateway.environment);
    console.log('   Sandbox Mode:', gateway.environment === 'SANDBOX');

    // 2. Criar cliente MP com as credenciais do banco
    console.log('\n2. Criando cliente Mercado Pago...');

    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 30000,
        testToken: gateway.environment === 'SANDBOX', // Importante para credenciais de teste
      },
    });

    console.log('   ✅ Cliente criado');

    // 3. Criar token de cartão
    console.log('\n3. Criando token de cartão de teste...');
    console.log('   Card:', TEST_CARD.cardNumber);
    console.log('   Holder:', TEST_CARD.cardholderName);

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

    console.log('   ✅ Token criado:');
    console.log('   Token ID:', tokenData.id);
    console.log('   First 6:', tokenData.first_six_digits);
    console.log('   Last 4:', tokenData.last_four_digits);

    // 4. Criar pagamento
    console.log('\n4. Criando pagamento...');

    const payment = new Payment(client);

    const paymentData = {
      transaction_amount: 1, // R$ 1.00 para teste
      description: 'Teste de pagamento completo',
      payment_method_id: 'master',
      token: tokenData.id,
      installments: 1,
      payer: {
        email: 'test_user_3007735626@testuser.com', // Test user email do MP
        first_name: 'Test',
        last_name: 'User',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
    };

    const paymentResponse = await payment.create({ body: paymentData });

    console.log('   ✅ Pagamento criado:');
    console.log('   Payment ID:', paymentResponse.id);
    console.log('   Status:', paymentResponse.status);
    console.log('   Status Detail:', paymentResponse.status_detail);
    console.log('   Amount:', paymentResponse.transaction_amount);
    console.log('   Date Created:', paymentResponse.date_created);
    console.log('   Date Approved:', paymentResponse.date_approved || 'N/A');

    // 5. Explicar o status
    console.log('\n5. Análise do status:');

    if (paymentResponse.status === 'approved') {
      console.log('   ✅ PAGAMENTO APROVADO!');
      console.log('   → A carteira deve ser creditada automaticamente');
    } else if (paymentResponse.status === 'in_process') {
      console.log('   ⏳ PAGAMENTO EM PROCESSO');
      console.log('   Status Detail:', paymentResponse.status_detail);

      if (paymentResponse.status_detail === 'pending_contingency') {
        console.log('\n   ℹ️  PENDING_CONTINGENCY:');
        console.log('   - Pagamento em análise de risco/fraude');
        console.log('   - Pode ser aprovado automaticamente em minutos');
        console.log('   - Pode requerer aprovação manual no dashboard');
        console.log('   - Webhook notificará quando status mudar');
        console.log('\n   💡 PRÓXIMOS PASSOS:');
        console.log('   1. Aguardar aprovação automática (alguns minutos)');
        console.log('   2. OU aprovar manualmente em:');
        console.log('      https://www.mercadopago.com.br/activities');
        console.log('   3. Webhook atualizará o status e creditará a carteira');
      }
    } else if (paymentResponse.status === 'pending') {
      console.log('   ⏳ PAGAMENTO PENDENTE');
      console.log('   Motivo:', paymentResponse.status_detail);
    } else if (paymentResponse.status === 'rejected') {
      console.log('   ❌ PAGAMENTO REJEITADO');
      console.log('   Motivo:', paymentResponse.status_detail);
    }

    // 6. Tentar sincronizar (caso já tenha sido aprovado)
    console.log('\n6. Tentando sincronizar com o banco...');

    try {
      const transaction = await updatePaymentFromMercadoPago(String(paymentResponse.id));
      console.log('   ✅ Transação sincronizada:');
      console.log('   Status no banco:', transaction.status);

      if (transaction.status === 'PAID' && transaction.userId) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: transaction.userId },
        });

        if (wallet) {
          console.log('   💰 Saldo da carteira:', wallet.balanceCents / 100);
        }
      }
    } catch (err) {
      console.log('   ℹ️  Sincronização não necessária (pagamento ainda pendente)');
    }

    console.log('\n========================================');
    console.log('✅ TESTE CONCLUÍDO');
    console.log('========================================');
    console.log('\n🔍 RESUMO:');
    console.log(`   - Payment ID: ${paymentResponse.id}`);
    console.log(`   - Status: ${paymentResponse.status}`);
    console.log(`   - Status Detail: ${paymentResponse.status_detail}`);
    console.log(`   - Carteira creditada: ${paymentResponse.status === 'approved' ? 'SIM' : 'AGUARDANDO APROVAÇÃO'}`);

  } catch (error: unknown) {
    console.error('\n❌ ERRO NO TESTE:');
    if (error && typeof error === 'object') {
      const err = error as { cause?: unknown[]; message?: string };
      if (err.cause && Array.isArray(err.cause)) {
        console.error('Detalhes do MP:', JSON.stringify(err.cause[0], null, 2));
      } else {
        console.error(err.message || 'Erro desconhecido');
      }
    } else {
      console.error(error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
