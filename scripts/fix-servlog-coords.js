// Script para adicionar coordenadas do ponto Servlog em João Pessoa
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixServlogCoords() {
  console.log('\n=== Atualizando coordenadas do ponto Servlog ===\n');

  try {
    // Coordenadas de João Pessoa/PB - Centro
    // Baseado no CEP 58082-000 (região de Mangabeira)
    const coords = {
      lat: -7.1195,
      lng: -34.8450,
    };

    // Atualizar o ponto Servlog
    const result = await prisma.pickupPoint.updateMany({
      where: {
        nomeFantasia: 'Servlog',
        cidade: 'João Pessoa',
        uf: 'PB',
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

fixServlogCoords();
