import { prisma } from '../lib/db';

async function main() {
  const items = await prisma.cartItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      document: true,
      createdAt: true,
    }
  });
  
  for (const item of items) {
    console.log('='.repeat(60));
    console.log('Item ID:', item.id);
    console.log('Created:', item.createdAt);
    console.log('Document:', JSON.stringify(item.document, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
