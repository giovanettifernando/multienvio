import { PrismaClient } from '@prisma/client';
import { getCardPanForDev } from '@/lib/services/account-cards.service';

const prisma = new PrismaClient();

async function main() {
  // Find the card
  const card = await prisma.card.findFirst({
    where: { last4: '6351' },
    select: {
      id: true,
      userId: true,
      brand: true,
      holderName: true,
      last4: true,
      expMonth: true,
      expYear: true,
      panCipher: true,
    },
  });

  if (!card) {
    console.log('Cartão não encontrado');
    return;
  }

  console.log('Cartão encontrado:', {
    id: card.id,
    brand: card.brand,
    last4: card.last4,
    holderName: card.holderName,
    expiration: `${String(card.expMonth).padStart(2, '0')}/${card.expYear}`,
  });

  try {
    const pan = await getCardPanForDev(card.userId, card.id);
    console.log('\nNúmero completo do cartão:', pan);
    console.log('\nVerificação:');
    console.log('- É cartão de teste MP?', pan === '5031433215406351' ? '✅ SIM' : '❌ NÃO');
  } catch (error) {
    console.error('Erro ao buscar PAN:', error);
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
