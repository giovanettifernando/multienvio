import { prisma } from '@/lib/db';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';
import { getPaymentById as getMPPaymentById } from '@/lib/mercadopago/client';

async function test() {
  try {
    console.log('\n🔄 Consultando pagamento no MP...\n');

    const mpPayment = await getMPPaymentById('1342664963');

    console.log('📊 Dados do MP:');
    console.log('  ID:', mpPayment.id);
    console.log('  Status:', mpPayment.status);
    console.log('  Status Detail:', mpPayment.status_detail);
    console.log('  Date Created:', mpPayment.date_created);
    console.log('  Date Approved:', mpPayment.date_approved);
    console.log('  Amount:', mpPayment.transaction_amount);
    console.log('  Payment Method:', mpPayment.payment_method_id);
    console.log('  Payment Type:', mpPayment.payment_type_id);

    console.log('\n🔄 Sincronizando pagamento...\n');

    const transaction = await updatePaymentFromMercadoPago('1342664963');

    console.log('✅ Pagamento sincronizado:');
    console.log('  ID:', transaction.id);
    console.log('  Status:', transaction.status);
    console.log('  Valor:', `R$ ${transaction.amountCents / 100}`);
    console.log('  Updated:', transaction.updatedAt);

    // Verificar carteira
    if (transaction.userId) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: transaction.userId },
      });

      console.log('\n💰 Saldo da carteira:');
      console.log('  Disponível:', `R$ ${wallet?.availableCents / 100 || 0}`);
      console.log('  Pendente:', `R$ ${wallet?.pendingCents / 100 || 0}`);

      // Verificar transações da carteira
      const walletTxs = await prisma.walletTransaction.findMany({
        where: {
          walletId: wallet?.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      console.log('\n📝 Últimas transações da carteira:');
      walletTxs.forEach((tx) => {
        console.log(`  - ${tx.type}: R$ ${tx.amountCents / 100} (${tx.status})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
