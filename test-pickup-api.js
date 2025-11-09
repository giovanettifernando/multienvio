/**
 * Teste da API de pontos de coleta
 */

async function testPickupPointsAPI() {
  const baseURL = 'http://localhost:3000';

  console.log('🧪 Testando API de pontos de coleta...\n');

  // Teste 1: Buscar todos os pontos
  console.log('1️⃣ GET /api/pickup-points (todos os pontos)');
  try {
    const res1 = await fetch(`${baseURL}/api/pickup-points`);
    const data1 = await res1.json();
    console.log('   Status:', res1.status);
    console.log('   Pontos retornados:', data1.length);
    console.log('   Dados:', JSON.stringify(data1, null, 2));
  } catch (error) {
    console.error('   Erro:', error.message);
  }

  console.log('\n2️⃣ GET /api/pickup-points?cidade=Curitiba&uf=PR');
  try {
    const res2 = await fetch(`${baseURL}/api/pickup-points?cidade=Curitiba&uf=PR`);
    const data2 = await res2.json();
    console.log('   Status:', res2.status);
    console.log('   Pontos retornados:', data2.length);
    console.log('   Dados:', JSON.stringify(data2, null, 2));
  } catch (error) {
    console.error('   Erro:', error.message);
  }

  console.log('\n3️⃣ GET /api/pickup-points?uf=PR');
  try {
    const res3 = await fetch(`${baseURL}/api/pickup-points?uf=PR`);
    const data3 = await res3.json();
    console.log('   Status:', res3.status);
    console.log('   Pontos retornados:', data3.length);
    console.log('   Dados:', JSON.stringify(data3, null, 2));
  } catch (error) {
    console.error('   Erro:', error.message);
  }
}

testPickupPointsAPI().catch(console.error);
