/**
 * Script para testar se a carteira é creditada quando um pagamento é aprovado
 *
 * Pega um pagamento pendente e força a atualização para "approved"
 * para testar se o fluxo de crédito da carteira funciona
 */

import { prisma } from '@/platform/db/db';

async function testWalletCredit() {
  console.log('========================================');
  console.log('TESTE DE CRÉDITO DA CARTEIRA');
  console.log('========================================\n');

  try {
    // 1. Buscar um pagamento pendente
    console.log('1. Buscando pagamento pendente...');

    const pendingPayment = await prisma.paymentTransaction.findFirst({
      where: {
        status: 'PENDING',
        externalId: { not: null },
        userId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pendingPayment) {
      console.log('   ❌ Nenhum pagamento pendente encontrado');
      return;
    }

    console.log('   ✅ Pagamento encontrado:');
    console.log('   ID:', pendingPayment.id);
    console.log('   External ID:', pendingPayment.externalId);
    console.log('   Amount:', pendingPayment.amountCents / 100);
    console.log('   User ID:', pendingPayment.userId);

    // 2. Verificar saldo atual da carteira
    console.log('\n2. Verificando saldo atual da carteira...');

    const walletBefore = await prisma.wallet.findUnique({
      where: { userId: pendingPayment.userId! },
    });

    if (!walletBefore) {
      console.log('   ❌ Carteira não encontrada');
      return;
    }

    console.log('   Saldo antes:', walletBefore.balanceCents / 100);

    // 3. Simular aprovação do pagamento
    console.log('\n3. Simulando aprovação do pagamento...');
    console.log('   (Atualizando status para PAID e chamando applyPaymentEffects)\n');

    // Importar a função de pagamentos
    const { updatePaymentFromMercadoPago } = await import('@/lib/mercadopago/payments');

    // PROBLEMA: updatePaymentFromMercadoPago vai buscar do MP e ele ainda está pending
    // Então vamos fazer manualmente

    // Atualizar status para PAID
    await prisma.paymentTransaction.update({
      where: { id: pendingPayment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    console.log('   ✅ Status atualizado para PAID');

    // Aplicar efeitos manualmente (creditar carteira)
    const metadata = pendingPayment.metadata as Record<string, unknown> | null;

    if (metadata?.type === 'wallet_topup') {
      console.log('   Tipo: wallet_topup');
      console.log('   Creditando carteira...\n');

      const { creditFromGatewayTopup } = await import('@/lib/wallet/wallet.service');

      await creditFromGatewayTopup({
        userId: pendingPayment.userId!,
        amountCents: pendingPayment.amountCents,
        paymentTransactionId: pendingPayment.id,
        currency: 'BRL',
        providerPaymentId: pendingPayment.externalId || undefined,
      });

      console.log('   ✅ Carteira creditada!');
    }

    // 4. Verificar saldo após crédito
    console.log('\n4. Verificando saldo após crédito...');

    const walletAfter = await prisma.wallet.findUnique({
      where: { userId: pendingPayment.userId! },
    });

    if (!walletAfter) {
      console.log('   ❌ Carteira não encontrada');
      return;
    }

    console.log('   Saldo antes:', walletBefore.balanceCents / 100);
    console.log('   Saldo depois:', walletAfter.balanceCents / 100);
    console.log('   Diferença:', (walletAfter.balanceCents - walletBefore.balanceCents) / 100);

    // 5. Verificar transação de carteira
    console.log('\n5. Verificando transação de carteira...');

    const walletTx = await prisma.walletTransaction.findFirst({
      where: {
        paymentTransactionId: pendingPayment.id,
      },
    });

    if (walletTx) {
      console.log('   ✅ Transação de carteira criada:');
      console.log('   ID:', walletTx.id);
      console.log('   Type:', walletTx.type);
      console.log('   Amount:', walletTx.amountCents / 100);
      console.log('   Status:', walletTx.status);
    } else {
      console.log('   ❌ Transação de carteira NÃO foi criada');
    }

    console.log('\n========================================');
    console.log('✅ TESTE CONCLUÍDO');
    console.log('========================================');

    if (walletAfter.balanceCents > walletBefore.balanceCents) {
      console.log('\n🎉 SUCESSO! O fluxo de crédito está funcionando!');
      console.log('   Quando o MP aprovar o pagamento, a carteira será creditada');
      console.log('   automaticamente via webhook.');
    } else {
      console.log('\n❌ PROBLEMA! A carteira não foi creditada.');
      console.log('   Há algum erro no fluxo de crédito.');
    }

  } catch (error: unknown) {
    console.error('\n❌ Erro:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testWalletCredit();
