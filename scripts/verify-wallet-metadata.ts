/**
 * Script para verificar se o payment ID do MP está sendo salvo no meta
 */

import { prisma } from '@/lib/db';

async function verify() {
  console.log('========================================');
  console.log('VERIFICAÇÃO DE METADATA DA CARTEIRA');
  console.log('========================================\n');

  try {
    // Buscar últimas transações de TOPUP (créditos de gateway)
    const topupTransactions = await prisma.walletTransaction.findMany({
      where: {
        type: 'TOPUP',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (topupTransactions.length === 0) {
      console.log('❌ Nenhuma transação de TOPUP encontrada');
      return;
    }

    console.log(`✅ Encontradas ${topupTransactions.length} transações de TOPUP\n`);

    topupTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. WalletTransaction`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Type: ${tx.type}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Amount: R$ ${(tx.amountCents / 100).toFixed(2)}`);
      console.log(`   Title: ${tx.title}`);
      console.log(`   Reference ID: ${tx.referenceId || 'N/A'}`);
      console.log(`   Created: ${tx.createdAt.toISOString()}`);
      console.log(`   Confirmed: ${tx.confirmedAt?.toISOString() || 'N/A'}`);

      // Mostrar metadata completa
      console.log(`   Meta (JSON):`);
      if (tx.meta) {
        const meta = tx.meta as Record<string, unknown>;
        console.log(`      - paymentTransactionId: ${meta.paymentTransactionId || 'N/A'}`);
        console.log(`      - externalId (MP Payment ID): ${meta.externalId || 'N/A'}`);
        console.log(`      - currency: ${meta.currency || 'N/A'}`);
        console.log(`      - source: ${meta.source || 'N/A'}`);
        console.log(`      - Full meta: ${JSON.stringify(meta, null, 2)}`);
      } else {
        console.log(`      ❌ Sem metadata`);
      }
      console.log('');
    });

    // Verificar se podemos rastrear de volta para PaymentTransaction
    console.log('🔍 Validando rastreabilidade...\n');

    for (const tx of topupTransactions.slice(0, 2)) {
      const meta = tx.meta as Record<string, unknown> | null;
      if (!meta) continue;

      const paymentTxId = meta.paymentTransactionId as string | undefined;
      const mpPaymentId = meta.externalId as string | undefined;

      if (paymentTxId) {
        const paymentTx = await prisma.paymentTransaction.findUnique({
          where: { id: paymentTxId },
        });

        console.log(`✅ Rastreamento da transação ${tx.id}:`);
        console.log(`   WalletTransaction → PaymentTransaction: ${paymentTxId}`);
        console.log(`   PaymentTransaction.externalId: ${paymentTx?.externalId || 'N/A'}`);
        console.log(`   PaymentTransaction.status: ${paymentTx?.status || 'N/A'}`);
        console.log(`   PaymentTransaction.amount: R$ ${paymentTx ? (paymentTx.amountCents / 100).toFixed(2) : 'N/A'}`);
        console.log(`   Mercado Pago Payment ID no meta: ${mpPaymentId || 'N/A'}`);

        if (paymentTx?.externalId === mpPaymentId) {
          console.log(`   ✅ IDs do MP coincidem! Auditoria completa OK`);
        } else {
          console.log(`   ⚠️  IDs do MP diferem`);
        }
        console.log('');
      }
    }

    console.log('========================================');
    console.log('✅ VERIFICAÇÃO CONCLUÍDA');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
