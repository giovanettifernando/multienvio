/**
 * Script para testar aprovação automática com diferentes configurações
 *
 * Testa várias combinações para descobrir o que faz o MP aprovar automaticamente
 */

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/integrations/shared/encryption.service';
import { MercadoPagoConfig, Payment, CardToken } from 'mercadopago';

// Cartões de teste do MP com diferentes comportamentos
const TEST_CARDS = [
  {
    name: 'Master APRO (aprovação)',
    cardNumber: '5031433215406351',
    cardholderName: 'APRO',
    expirationMonth: '11',
    expirationYear: '2025',
    securityCode: '123',
  },
  {
    name: 'Visa APRO (aprovação)',
    cardNumber: '4509953566233704',
    cardholderName: 'APRO',
    expirationMonth: '11',
    expirationYear: '2025',
    securityCode: '123',
  },
];

// Emails de teste
const TEST_EMAILS = [
  'test_user_3007735626@testuser.com', // Buyer criado pelo usuário
  'test@test.com', // Email genérico
];

async function testAutoApproval() {
  console.log('========================================');
  console.log('TESTE DE APROVAÇÃO AUTOMÁTICA');
  console.log('========================================\n');

  try {
    // 1. Buscar credenciais
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago', status: 'ACTIVE' },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!gateway || gateway.credentials.length === 0) {
      throw new Error('Gateway não encontrado');
    }

    const credential = gateway.credentials[0];
    const accessToken = credential.accessToken ? decrypt(credential.accessToken) : '';

    console.log('✅ Credenciais carregadas');
    console.log('   Environment:', gateway.environment);
    console.log('   Access Token:', accessToken.substring(0, 30) + '...\n');

    // 2. Criar cliente MP
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 30000,
        testToken: true, // CRÍTICO: indica que são credenciais de teste
      },
    });

    // 3. Testar apenas o primeiro cartão com o primeiro email
    const card = TEST_CARDS[0];
    const email = TEST_EMAILS[0];

    console.log('🧪 TESTE:');
    console.log('   Cartão:', card.name);
    console.log('   Número:', card.cardNumber);
    console.log('   Titular:', card.cardholderName);
    console.log('   Email:', email);
    console.log('');

    // 3.1. Criar token
    console.log('1. Criando token...');
    const cardToken = new CardToken(client);

    const tokenData = await cardToken.create({
      body: {
        card_number: card.cardNumber,
        expiration_month: card.expirationMonth,
        expiration_year: card.expirationYear,
        security_code: card.securityCode,
        cardholder: {
          name: card.cardholderName,
          identification: {
            type: 'CPF',
            number: '12345678909',
          },
        },
      },
    });

    console.log('   ✅ Token:', tokenData.id.substring(0, 20) + '...\n');

    // 3.2. Criar pagamento com payload mínimo (como documentação recomenda)
    console.log('2. Criando pagamento...');
    const payment = new Payment(client);

    const paymentPayload = {
      transaction_amount: 100, // Valor de R$ 100 para teste
      token: tokenData.id,
      description: 'Teste de aprovação automática',
      installments: 1,
      payment_method_id: card.cardNumber.startsWith('5') ? 'master' : 'visa',
      payer: {
        email,
      },
    };

    console.log('   Payload enviado:', JSON.stringify(paymentPayload, null, 2));

    const paymentResponse = await payment.create({ body: paymentPayload });

    console.log('\n3. ✅ Resposta do MP:');
    console.log('   Payment ID:', paymentResponse.id);
    console.log('   Status:', paymentResponse.status);
    console.log('   Status Detail:', paymentResponse.status_detail);
    console.log('   Date Created:', paymentResponse.date_created);
    console.log('   Date Approved:', paymentResponse.date_approved || 'N/A');

    // 3.3. Análise
    console.log('\n4. 📊 ANÁLISE:');

    if (paymentResponse.status === 'approved') {
      console.log('   ✅ SUCESSO! Pagamento aprovado automaticamente!');
      console.log('   → A configuração está correta');
      console.log('   → Use este mesmo payload no sistema');
    } else if (paymentResponse.status === 'in_process') {
      console.log('   ⏳ Pagamento em processo');
      console.log('   Status Detail:', paymentResponse.status_detail);

      if (paymentResponse.status_detail === 'pending_contingency') {
        console.log('\n   ❌ PENDING_CONTINGENCY detectado');
        console.log('\n   Possíveis causas:');
        console.log('   1. Conta de teste precisa de ativação/configuração');
        console.log('   2. Credenciais podem não ser de teste verdadeiro');
        console.log('   3. MP pode estar com restrições na conta');
        console.log('   4. Problemas com configurações de segurança');
        console.log('\n   Vou verificar algumas coisas adicionais...');

        // Tentar buscar mais detalhes
        await new Promise(resolve => setTimeout(resolve, 3000));

        const updated = await payment.get({ id: String(paymentResponse.id) });
        console.log('\n   Status após 3 segundos:', updated.status);

        if (updated.status === 'approved') {
          console.log('   ✅ Foi aprovado! Apenas demorou alguns segundos');
        } else {
          console.log('\n   💡 RECOMENDAÇÃO:');
          console.log('   - Verifique se a aplicação no MP está em modo produção');
          console.log('   - Tente criar novas credenciais de teste');
          console.log('   - Verifique se há restrições de segurança ativadas');
        }
      }
    } else if (paymentResponse.status === 'rejected') {
      console.log('   ❌ Pagamento rejeitado');
      console.log('   Motivo:', paymentResponse.status_detail);
    }

    console.log('\n========================================');

  } catch (error: unknown) {
    console.error('\n❌ Erro:', error);
    if (error && typeof error === 'object') {
      const err = error as { cause?: unknown[] };
      if (err.cause && Array.isArray(err.cause)) {
        console.error('Detalhes do MP:', JSON.stringify(err.cause[0], null, 2));
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

testAutoApproval();
