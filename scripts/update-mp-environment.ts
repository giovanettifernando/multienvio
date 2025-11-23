import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Atualizando ambiente do gateway Mercado Pago para PRODUCTION...\n');

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
      environment: 'PRODUCTION',
    },
  });

  console.log('\n✅ Gateway atualizado com sucesso!');
  console.log('Novo ambiente:', {
    id: updated.id,
    slug: updated.slug,
    environment: updated.environment,
    status: updated.status,
  });

  console.log('\n⚠️  IMPORTANTE: Limpar cache do servidor para aplicar as mudanças.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
