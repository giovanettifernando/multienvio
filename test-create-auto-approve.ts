import { prisma } from '@/lib/db';
import { createPaymentWithTracking } from '@/lib/mercadopago/payments';

async function test() {
  try {
    console.log('\n💳 Criando pagamento com cartão APRO (auto-aprovação)...\n');

    // Buscar um cartão salvo do usuário
    const card = await prisma.savedCard.findFirst({
      where: {
        userId: 'ccad7a5b-1251-4488-927a-022016095247',
        isActive: true,
      },
    });

    if (!card) {
      console.error('Nenhum cartão salvo encontrado');
      return;
    }

    console.log('Cartão encontrado:', card.id);
    console.log('Holder:', card.holderName);

    // Criar pagamento
    const result = await createPaymentWithTracking({
      transactionAmount: 50.00,
      token: card.mpCardId || '', // Se tiver token MP salvo
      description: 'Teste auto-aprovação APRO',
      installments: 1,
      paymentMethodId: 'master',
      payer: {
        email: 'test@test.com',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
      metadata: {
        userId: 'ccad7a5b-1251-4488-927a-022016095247',
        type: 'wallet_topup',
      },
    });

    console.log('\n✅ Pagamento criado:');
    console.log('  Transaction ID:', result.transaction.id);
    console.log('  Status:', result.transaction.status);
    console.log('  MP Payment ID:', result.transaction.externalId);
    console.log('  MP Status:', result.paymentData.status);
    console.log('  MP Status Detail:', result.paymentData.status_detail);

    // Aguardar um pouco e verificar novamente
    console.log('\n⏳ Aguardando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const updated = await prisma.paymentTransaction.findUnique({
      where: { id: result.transaction.id },
    });

    console.log('\n📊 Status após 3s:');
    console.log('  Status:', updated?.status);

    // Verificar carteira
    const wallet = await prisma.wallet.findUnique({
      where: { userId: 'ccad7a5b-1251-4488-927a-022016095247' },
    });

    console.log('\n💰 Saldo da carteira:');
    console.log('  Disponível:', `R$ ${wallet?.availableCents / 100 || 0}`);

  } catch (error) {
    console.error('\n❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
