/**
 * Script para verificar os pagamentos recentes no banco
 */

import { prisma } from '@/platform/db/db';

async function checkRecentPayments() {
  console.log('========================================');
  console.log('PAGAMENTOS RECENTES NO BANCO');
  console.log('========================================\n');

  try {
    const payments = await prisma.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (payments.length === 0) {
      console.log('Nenhum pagamento encontrado');
      return;
    }

    console.log(`Encontrados ${payments.length} pagamentos:\n`);

    payments.forEach((payment, index) => {
      console.log(`${index + 1}. Payment Transaction`);
      console.log(`   ID: ${payment.id}`);
      console.log(`   External ID: ${payment.externalId || 'N/A'}`);
      console.log(`   Reference ID: ${payment.referenceId}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Amount: R$ ${(payment.amountCents / 100).toFixed(2)}`);
      console.log(`   Method: ${payment.method}`);
      console.log(`   User: ${payment.user?.email || 'N/A'}`);
      console.log(`   Created: ${payment.createdAt.toISOString()}`);
      console.log(`   Updated: ${payment.updatedAt.toISOString()}`);

      if (payment.metadata) {
        console.log(`   Metadata: ${JSON.stringify(payment.metadata, null, 2)}`);
      }

      console.log('');
    });

    // Verificar se há algum pagamento PAID que deveria ter creditado a carteira
    const paidPayments = payments.filter(p => p.status === 'PAID');
    if (paidPayments.length > 0) {
      console.log('\n🔍 Verificando pagamentos PAID...\n');

      for (const payment of paidPayments) {
        if (!payment.userId) continue;

        const walletTransactions = await prisma.walletTransaction.findMany({
          where: {
            paymentTransactionId: payment.id,
          },
        });

        console.log(`Payment ${payment.id}:`);
        if (walletTransactions.length > 0) {
          console.log(`   ✅ ${walletTransactions.length} transação(ões) de carteira encontrada(s)`);
        } else {
          console.log(`   ❌ Nenhuma transação de carteira encontrada (PROBLEMA!)`);
        }
      }
    }

    console.log('\n========================================');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentPayments();
