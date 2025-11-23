/**
 * Script para sincronizar pagamentos pendentes com o Mercado Pago
 *
 * Verifica se algum pagamento pendente no banco foi aprovado no MP
 * e atualiza o status + credita a carteira se necessário
 */

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '@/lib/db';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';

// Credenciais de teste
const ACCESS_TOKEN = 'APP_USR-2173989860016629-112114-4be0f475c015b3248dec30775c7f28ae-3007735624';

async function syncPendingPayments() {
  console.log('========================================');
  console.log('SINCRONIZAÇÃO DE PAGAMENTOS PENDENTES');
  console.log('========================================\n');

  try {
    // 1. Buscar pagamentos pendentes no banco
    const pendingPayments = await prisma.paymentTransaction.findMany({
      where: {
        status: 'PENDING',
        externalId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (pendingPayments.length === 0) {
      console.log('✅ Nenhum pagamento pendente com externalId');
      return;
    }

    console.log(`📋 Encontrados ${pendingPayments.length} pagamentos pendentes\n`);

    // 2. Configurar cliente MP
    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
      options: {
        timeout: 30000,
      },
    });

    const payment = new Payment(client);

    // 3. Verificar cada pagamento no MP
    for (const pending of pendingPayments) {
      console.log(`\n🔍 Verificando pagamento ${pending.externalId}...`);
      console.log(`   Criado em: ${pending.createdAt.toISOString()}`);
      console.log(`   Amount: R$ ${(pending.amountCents / 100).toFixed(2)}`);

      try {
        // Consultar no MP
        const mpPayment = await payment.get({ id: pending.externalId! });

        console.log(`   Status no MP: ${mpPayment.status}`);
        console.log(`   Status Detail: ${mpPayment.status_detail}`);

        // Se foi aprovado, sincronizar
        if (mpPayment.status === 'approved') {
          console.log(`   ✅ APROVADO! Sincronizando...`);

          const updated = await updatePaymentFromMercadoPago(pending.externalId!);
          console.log(`   ✅ Status atualizado para: ${updated.status}`);

          // Verificar se a carteira foi creditada
          if (pending.userId) {
            const walletTransactions = await prisma.walletTransaction.findMany({
              where: { paymentTransactionId: updated.id },
            });

            if (walletTransactions.length > 0) {
              console.log(`   💰 Carteira creditada com R$ ${(walletTransactions[0].amountCents / 100).toFixed(2)}`);
            } else {
              console.log(`   ⚠️  Carteira NÃO foi creditada (verificar logs)`);
            }
          }
        } else if (mpPayment.status === 'in_process' || mpPayment.status === 'pending') {
          console.log(`   ⏳ Ainda pendente no MP`);
          console.log(`   💡 Status Detail: ${mpPayment.status_detail}`);

          // Explicar o que é pending_contingency
          if (mpPayment.status_detail === 'pending_contingency') {
            console.log(`\n   ℹ️  PENDING_CONTINGENCY significa:`);
            console.log(`      - Pagamento em análise de risco/fraude`);
            console.log(`      - Pode ser aprovado automaticamente em minutos/horas`);
            console.log(`      - Pode requerer aprovação manual no dashboard MP`);
            console.log(`      - Webhook notificará quando status mudar`);
          }
        } else if (mpPayment.status === 'rejected') {
          console.log(`   ❌ Rejeitado no MP`);
          console.log(`   Motivo: ${mpPayment.status_detail}`);
        } else {
          console.log(`   ℹ️  Status: ${mpPayment.status}`);
        }

      } catch (error: unknown) {
        if (error && typeof error === 'object') {
          const err = error as { cause?: unknown[] };
          if (err.cause && Array.isArray(err.cause)) {
            const mpError = err.cause[0] as { code?: number; description?: string };
            if (mpError.code === 2000) {
              console.log(`   ⚠️  Pagamento não encontrado no MP (pode ter expirado)`);
            } else {
              console.log(`   ❌ Erro ao consultar MP:`, mpError);
            }
          }
        } else {
          console.log(`   ❌ Erro:`, error);
        }
      }
    }

    console.log('\n========================================');
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncPendingPayments()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
