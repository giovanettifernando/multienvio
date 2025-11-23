import { PrismaClient } from '@prisma/client';
import { decrypt } from '../lib/integrations/shared/encryption.service';

const prisma = new PrismaClient();

async function main() {
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago' },
    include: {
      credentials: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });

  if (!gateway) {
    console.log('Gateway Mercado Pago não encontrado');
    return;
  }

  console.log('Gateway:', {
    id: gateway.id,
    slug: gateway.slug,
    status: gateway.status,
    environment: gateway.environment,
  });

  console.log('\nCredenciais:');
  gateway.credentials.forEach((cred, index) => {
    // Descriptografar accessToken
    const accessToken = cred.accessToken ? decrypt(cred.accessToken) : null;

    console.log(`\n[${index + 1}]`, {
      id: cred.id,
      publicKey: cred.publicKey,
      accessTokenEncrypted: cred.accessToken?.substring(0, 40) + '...',
      accessTokenDecrypted: accessToken,
      isActive: cred.isActive,
      createdAt: cred.createdAt,
    });
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
