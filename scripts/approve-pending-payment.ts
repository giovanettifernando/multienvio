/**
 * Script para aprovar pagamento pendente manualmente
 *
 * Em modo teste, alguns pagamentos podem ficar em pending_contingency
 * mesmo com "APRO". Este script tenta forçar a aprovação.
 */

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/integrations/shared/encryption.service';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const PAYMENT_ID = '1342663235'; // Último pagamento criado

async function approvePayment() {
  console.log('========================================');
  console.log('TENTANDO APROVAR PAGAMENTO PENDENTE');
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

    // 2. Criar cliente MP
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 30000,
        testToken: gateway.environment === 'SANDBOX',
      },
    });

    const payment = new Payment(client);

    // 3. Consultar pagamento atual
    console.log(`1. Consultando pagamento ${PAYMENT_ID}...`);
    const paymentData = await payment.get({ id: PAYMENT_ID });

    console.log('   Status atual:', paymentData.status);
    console.log('   Status Detail:', paymentData.status_detail);
    console.log('   Date Created:', paymentData.date_created);

    if (paymentData.status === 'approved') {
      console.log('\n   ✅ Pagamento já está aprovado!');
      return;
    }

    // 4. Em modo teste, não há API pública para aprovar manualmente
    // O único jeito é pelo dashboard
    console.log('\n2. ℹ️  COMO APROVAR MANUALMENTE:\n');
    console.log('   O Mercado Pago não fornece API pública para aprovar');
    console.log('   pagamentos de teste manualmente via código.\n');
    console.log('   OPÇÕES:\n');
    console.log('   A) Aguardar aprovação automática (pode levar alguns minutos)');
    console.log('   B) Aprovar no dashboard do Mercado Pago:');
    console.log('      1. Acesse: https://www.mercadopago.com.br/activities');
    console.log(`      2. Procure pelo pagamento ID: ${PAYMENT_ID}`);
    console.log('      3. Clique para ver detalhes');
    console.log('      4. Se houver opção de aprovar, clique nela\n');
    console.log('   C) Usar cartões com valores específicos que auto-aprovam:');
    console.log('      - Valor R$ 1.00 ou R$ 10.00 costuma aprovar mais rápido');
    console.log('      - Alguns cartões de teste têm comportamento diferente\n');
    console.log('   D) Verificar se a conta de teste está configurada:');
    console.log('      https://www.mercadopago.com.br/developers/panel/test-accounts');

    // 5. Monitorar por alguns segundos
    console.log('\n3. 🔄 Vou monitorar o status por 30 segundos...\n');

    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const updated = await payment.get({ id: PAYMENT_ID });
      console.log(`   [${i + 1}/6] Status: ${updated.status} (${updated.status_detail})`);

      if (updated.status === 'approved') {
        console.log('\n   ✅ PAGAMENTO APROVADO AUTOMATICAMENTE!');
        return;
      }
    }

    console.log('\n   ⏳ Pagamento ainda pendente após 30 segundos');
    console.log('   Siga as opções acima para aprovar manualmente');

  } catch (error: unknown) {
    console.error('\n❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approvePayment();
