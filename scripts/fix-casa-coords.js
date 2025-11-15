// Script para adicionar coordenadas do ponto Casa em Paranavaí
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCasaCoords() {
  console.log('\n=== Atualizando coordenadas do ponto Casa ===\n');

  try {
    // Coordenadas de Paranavaí/PR - Centro
    // Baseado no CEP 87703-550
    const coords = {
      lat: -23.0733,
      lng: -52.4650,
    };

    // Atualizar o ponto Casa
    const result = await prisma.pickupPoint.updateMany({
      where: {
        nomeFantasia: 'Casa',
        cidade: 'Paranavaí',
        uf: 'PR',
      },
      data: {
        geo: coords,
      },
    });

    if (result.count > 0) {
      console.log(`✅ Coordenadas atualizadas com sucesso!`);
      console.log(`   Latitude: ${coords.lat}`);
      console.log(`   Longitude: ${coords.lng}`);
      console.log(`   Pontos atualizados: ${result.count}`);
    } else {
      console.log('⚠️  Nenhum ponto foi atualizado. Verifique se o ponto existe.');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCasaCoords();
