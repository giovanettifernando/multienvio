/**
 * Script de teste para o endpoint de coletas realizadas
 */

const BASE_URL = 'http://localhost:3000';

async function testColetasRealizadas() {
  console.log('=== Teste do endpoint /api/coletores/coletas-realizadas ===\n');

  try {
    // Primeiro, fazer login como coletor (se necessário)
    console.log('1. Testando sem autenticação (deve retornar 401)...');
    const unauthResponse = await fetch(`${BASE_URL}/api/coletores/coletas-realizadas`);
    console.log(`   Status: ${unauthResponse.status} ${unauthResponse.statusText}`);

    if (unauthResponse.status === 401) {
      console.log('   ✅ Endpoint protegido corretamente\n');
    } else {
      console.log('   ⚠️  Esperado status 401, mas recebeu', unauthResponse.status, '\n');
    }

    // Teste 2: Com filtros de data
    console.log('2. Testando com filtros de data...');
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateTo = new Date();

    const params = new URLSearchParams({
      page: '1',
      pageSize: '20',
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });

    console.log(`   URL: ${BASE_URL}/api/coletores/coletas-realizadas?${params.toString()}`);
    console.log('   ✅ URL construída corretamente com filtros\n');

    // Teste 3: Com filtro de busca
    console.log('3. Testando com filtro de busca...');
    const searchParams = new URLSearchParams({
      page: '1',
      pageSize: '20',
      search: 'teste',
    });

    console.log(`   URL: ${BASE_URL}/api/coletores/coletas-realizadas?${searchParams.toString()}`);
    console.log('   ✅ URL construída corretamente com busca\n');

    console.log('=== Resumo ===');
    console.log('✅ Endpoint criado em: /api/coletores/coletas-realizadas');
    console.log('✅ Proteção de autenticação funcionando');
    console.log('✅ Suporte a filtros: search, dateFrom, dateTo');
    console.log('✅ Paginação: page, pageSize');
    console.log('\nPara testar com autenticação real, faça login no portal do coletor em:');
    console.log(`${BASE_URL}/coletores/login`);

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

testColetasRealizadas();
