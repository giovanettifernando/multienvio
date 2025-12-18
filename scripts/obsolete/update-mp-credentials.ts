import { PrismaClient } from '@prisma/client';
import { updatePaymentCredential } from '@/lib/integrations/payments/payment-credential.service';

const prisma = new PrismaClient();

async function main() {
  // New credentials provided by user
  const newPublicKey = 'APP_USR-332de454-0b11-439e-92ee-f4a60814ecc9';
  const newAccessToken = 'APP_USR-2173989860016629-112114-4be0f475c015b3248dec30775c7f28ae-3007735624';

  // Find Mercado Pago gateway and active credential
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
    include: {
      credentials: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!gateway) {
    console.error('Gateway Mercado Pago não encontrado');
    process.exit(1);
  }

  if (!gateway.credentials || gateway.credentials.length === 0) {
    console.error('Nenhuma credencial ativa encontrada');
    process.exit(1);
  }

  const currentCred = gateway.credentials[0];

  console.log('Credencial atual:', {
    id: currentCred.id,
    publicKey: currentCred.publicKey,
    environment: currentCred.environment,
  });

  console.log('\nAtualizando credenciais...');

  try {
    const updated = await updatePaymentCredential(currentCred.id, {
      publicKey: newPublicKey,
      accessToken: newAccessToken,
    });

    console.log('\n✅ Credenciais atualizadas com sucesso!');
    console.log('Nova credencial:', {
      id: updated.id,
      publicKey: updated.publicKey,
      environment: gateway.environment,
    });
  } catch (error) {
    console.error('\n❌ Erro ao atualizar credenciais:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
