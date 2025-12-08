#!/usr/bin/env node
/**
 * Script para verificar pagamentos recentes e seus status
 *
 * Uso: npx tsx scripts/check-recent-payments.mjs
 */

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  console.log('=== Verificando pagamentos recentes ===\n');

  // Buscar últimos 10 pagamentos
  const payments = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: {
        select: { email: true }
      }
    }
  });

  if (payments.length === 0) {
    console.log('Nenhum pagamento encontrado.');
    return;
  }

  for (const p of payments) {
    const metadata = p.metadata || {};
    console.log(`ID: ${p.id}`);
    console.log(`  External ID (MP): ${p.externalId || 'N/A'}`);
    console.log(`  Reference ID: ${p.referenceId}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Método: ${p.method}`);
    console.log(`  Valor: R$ ${(p.amountCents / 100).toFixed(2)}`);
    console.log(`  User ID: ${p.userId || 'N/A'}`);
    console.log(`  User Email: ${p.user?.email || 'N/A'}`);
    console.log(`  Metadata Type: ${metadata.type || 'N/A'}`);
    console.log(`  Criado em: ${p.createdAt.toISOString()}`);
    console.log(`  Pago em: ${p.paidAt?.toISOString() || 'N/A'}`);
    console.log('');
  }

  // Verificar se há WalletTransactions correspondentes
  console.log('=== Verificando WalletTransactions relacionadas ===\n');

  for (const p of payments) {
    if (p.status === 'PAID') {
      const walletTx = await prisma.walletTransaction.findFirst({
        where: {
          meta: {
            path: ['paymentTransactionId'],
            equals: p.id
          }
        }
      });

      if (walletTx) {
        console.log(`Payment ${p.id} -> WalletTransaction ${walletTx.id} (${walletTx.status})`);
      } else {
        console.log(`⚠️  Payment ${p.id} está PAID mas NÃO tem WalletTransaction!`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
