// Script para adicionar coordenadas do ponto Neoera em Curitiba
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixNeoeraCoords() {
  console.log('\n=== Atualizando coordenadas do ponto Neoera ===\n');

  try {
    // Coordenadas de Curitiba/PR - Alto da Glória (aproximadas)
    // Baseado no CEP 80030-000 (Av. João Gualberto, Alto da Glória)
    const coords = {
      lat: -25.4284,
      lng: -49.2733,
    };

    // Atualizar o ponto Neoera
    const result = await prisma.pickupPoint.updateMany({
      where: {
        nomeFantasia: 'Neoera',
        cidade: 'Curitiba',
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

fixNeoeraCoords();
