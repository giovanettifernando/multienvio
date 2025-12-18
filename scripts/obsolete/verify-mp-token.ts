import { PrismaClient } from '@prisma/client';
import { getPaymentCredentialDecrypted } from '@/lib/integrations/payments/payment-credential.service';

const prisma = new PrismaClient();

async function main() {
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

  if (!gateway || !gateway.credentials[0]) {
    console.error('Credencial não encontrada');
    process.exit(1);
  }

  const credId = gateway.credentials[0].id;

  console.log('Buscando credencial descriptografada...\n');

  const decrypted = await getPaymentCredentialDecrypted(credId);

  if (!decrypted) {
    console.error('Erro ao descriptografar credencial');
    process.exit(1);
  }

  console.log('Credenciais descriptografadas:');
  console.log('- Public Key:', decrypted.publicKey);
  console.log('- Access Token:', decrypted.accessToken || '(vazio)');
  console.log('\nEsperado:');
  console.log('- Public Key: APP_USR-332de454-0b11-439e-92ee-f4a60814ecc9');
  console.log('- Access Token: APP_USR-2173989860016629-112114-4be0f475c015b3248dec30775c7f28ae-3007735624');

  const matches = {
    publicKey: decrypted.publicKey === 'APP_USR-332de454-0b11-439e-92ee-f4a60814ecc9',
    accessToken: decrypted.accessToken === 'APP_USR-2173989860016629-112114-4be0f475c015b3248dec30775c7f28ae-3007735624',
  };

  console.log('\nVerificação:');
  console.log('✓ Public Key:', matches.publicKey ? '✅ OK' : '❌ DIFERENTE');
  console.log('✓ Access Token:', matches.accessToken ? '✅ OK' : '❌ DIFERENTE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
