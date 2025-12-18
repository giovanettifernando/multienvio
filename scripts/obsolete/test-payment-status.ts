/**
 * Script para verificar status de pagamento e testar atualização da carteira
 *
 * Este script:
 * 1. Consulta o status do pagamento na API do MP
 * 2. Testa a atualização do status para approved
 * 3. Verifica se a carteira é creditada corretamente
 */

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '@/platform/db/db';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';

// Credenciais de teste
const ACCESS_TOKEN = 'APP_USR-2173989860016629-112114-4be0f475c015b3248dec30775c7f28ae-3007735624';

// ID do pagamento que queremos verificar
const PAYMENT_ID = '1342663217';

async function checkPaymentStatus() {
  console.log('========================================');
  console.log('VERIFICAÇÃO DE STATUS DE PAGAMENTO');
  console.log('========================================\n');

  try {
    // 1. Consultar status atual no MP
    console.log('1. Consultando status do pagamento no Mercado Pago...');
    console.log(`   Payment ID: ${PAYMENT_ID}`);

    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
      options: {
        timeout: 30000,
      },
    });

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: PAYMENT_ID });

    console.log('\n✅ Dados do pagamento no MP:');
    console.log('   ID:', paymentData.id);
    console.log('   Status:', paymentData.status);
    console.log('   Status Detail:', paymentData.status_detail);
    console.log('   Amount:', paymentData.transaction_amount);
    console.log('   Date Created:', paymentData.date_created);
    console.log('   Date Approved:', paymentData.date_approved);
    console.log('   Payment Method:', paymentData.payment_method_id);
    console.log('   Payer Email:', paymentData.payer?.email);

    // 2. Buscar transação no nosso banco
    console.log('\n2. Verificando transação no banco de dados...');
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { externalId: PAYMENT_ID },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      console.log('   ⚠️  Transação não encontrada no banco');
    } else {
      console.log('\n✅ Transação no banco:');
      console.log('   ID:', transaction.id);
      console.log('   Status:', transaction.status);
      console.log('   Amount:', transaction.amountCents / 100);
      console.log('   User:', transaction.user?.email);
      console.log('   Created:', transaction.createdAt);
      console.log('   Updated:', transaction.updatedAt);

      // 3. Verificar saldo da carteira
      if (transaction.userId) {
        console.log('\n3. Verificando saldo da carteira...');
        const wallet = await prisma.wallet.findUnique({
          where: { userId: transaction.userId },
        });

        if (wallet) {
          console.log('   Saldo atual:', wallet.balanceCents / 100);
          console.log('   Última atualização:', wallet.updatedAt);
        } else {
          console.log('   ⚠️  Carteira não encontrada');
        }

        // 4. Verificar transações da carteira relacionadas
        console.log('\n4. Verificando transações da carteira...');
        const walletTransactions = await prisma.walletTransaction.findMany({
          where: {
            paymentTransactionId: transaction.id,
          },
        });

        if (walletTransactions.length > 0) {
          console.log(`   ✅ Encontradas ${walletTransactions.length} transação(ões):`);
          walletTransactions.forEach((wt) => {
            console.log(`      - ${wt.type}: ${wt.amountCents / 100} (${wt.status})`);
          });
        } else {
          console.log('   ⚠️  Nenhuma transação de carteira encontrada');
          console.log('   → Isso explica por que o saldo não foi creditado!');
        }
      }
    }

    // 5. Se o pagamento está aprovado no MP mas não no nosso banco, tentar sincronizar
    if (paymentData.status === 'approved' && transaction?.status !== 'PAID') {
      console.log('\n5. 🔄 Pagamento aprovado no MP mas não sincronizado!');
      console.log('   Tentando sincronizar...');

      const updated = await updatePaymentFromMercadoPago(PAYMENT_ID);
      console.log('   ✅ Transação atualizada:', updated.status);

      // Verificar se a carteira foi creditada
      if (transaction.userId) {
        const walletAfter = await prisma.wallet.findUnique({
          where: { userId: transaction.userId },
        });

        if (walletAfter) {
          console.log('   Novo saldo da carteira:', walletAfter.balanceCents / 100);
        }
      }
    } else if (paymentData.status !== 'approved') {
      console.log('\n5. ⚠️  Pagamento ainda não aprovado no Mercado Pago');
      console.log('   Status:', paymentData.status);
      console.log('   Status Detail:', paymentData.status_detail);
      console.log('\n   💡 PRÓXIMOS PASSOS:');
      console.log('   - Aguardar aprovação automática do MP (pode levar alguns minutos)');
      console.log('   - OU aprovar manualmente no dashboard do MP');
      console.log('   - Webhook receberá notificação e creditará a carteira');
      console.log('   - OU executar este script novamente para sincronizar manualmente');
    }

    console.log('\n========================================');
    console.log('✅ VERIFICAÇÃO CONCLUÍDA');
    console.log('========================================');

  } catch (error: unknown) {
    console.error('\n❌ ERRO:');
    if (error && typeof error === 'object') {
      const err = error as { cause?: unknown[]; message?: string };
      if (err.cause && Array.isArray(err.cause)) {
        console.error('Detalhes:', JSON.stringify(err.cause[0], null, 2));
      } else {
        console.error(err.message || 'Erro desconhecido');
      }
    } else {
      console.error(error);
    }
    console.log('========================================');
  }
}

checkPaymentStatus()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
