import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Configurando gateway Mercado Pago para SANDBOX (ambiente de testes)...\n');

  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
  });

  if (!gateway) {
    console.error('❌ Gateway Mercado Pago não encontrado');
    process.exit(1);
  }

  console.log('Gateway atual:', {
    id: gateway.id,
    slug: gateway.slug,
    environment: gateway.environment,
    status: gateway.status,
  });

  const updated = await prisma.paymentGateway.update({
    where: { id: gateway.id },
    data: {
      environment: 'SANDBOX',
    },
  });

  console.log('\n✅ Gateway configurado para SANDBOX!');
  console.log('Ambiente atualizado:', {
    id: updated.id,
    slug: updated.slug,
    environment: updated.environment,
    status: updated.status,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
