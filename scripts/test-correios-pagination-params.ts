/**
 * Testa diferentes parâmetros de paginação da API de agências dos Correios
 */

import { correiosFetch } from '../lib/integrations/correios/client';

async function testPaginationParam(pageName: string, sizeName: string) {
  console.log(`\n=== Testando ${pageName}/${sizeName} ===`);

  const params0 = new URLSearchParams({
    uf: 'PB',
    status: '2',
    [sizeName]: '10',
    [pageName]: '0',
  });

  const params1 = new URLSearchParams({
    uf: 'PB',
    status: '2',
    [sizeName]: '10',
    [pageName]: '1',
  });

  try {
    // Página 0
    const url0 = `/agencia/v1/unidades?${params0}`;
    console.log('URL página 0:', url0);
    const resp0 = await correiosFetch<{ itens: Array<{ id: string; nome: string }> }>(url0, { method: 'GET' });
    const ids0 = resp0.itens?.slice(0, 3).map((a) => `${a.id}: ${a.nome}`) || [];
    console.log('Página 0 - primeiros 3:', ids0);

    // Página 1
    const url1 = `/agencia/v1/unidades?${params1}`;
    console.log('URL página 1:', url1);
    const resp1 = await correiosFetch<{ itens: Array<{ id: string; nome: string }> }>(url1, { method: 'GET' });
    const ids1 = resp1.itens?.slice(0, 3).map((a) => `${a.id}: ${a.nome}`) || [];
    console.log('Página 1 - primeiros 3:', ids1);

    // Verificar se são diferentes
    const isDifferent = ids0[0] !== ids1[0];
    console.log(`\n>> Resultado: ${isDifferent ? '✓ FUNCIONA!' : '✗ Mesmos dados'}`);

    return isDifferent;
  } catch (error) {
    console.error('Erro:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log('Testando diferentes combinações de parâmetros de paginação...\n');

  // Combinações comuns de nomes de parâmetros
  const combinations = [
    ['pagina', 'quantidade'],   // O que estamos usando
    ['page', 'size'],           // Comum em APIs REST
    ['pageNumber', 'pageSize'], // Java-style
    ['pg', 'qtd'],              // Abreviado
    ['pag', 'qtd'],             // Outra abreviação
    ['offset', 'limit'],        // SQL-style (offset em itens, não páginas)
  ];

  for (const [pageName, sizeName] of combinations) {
    const success = await testPaginationParam(pageName, sizeName);
    if (success) {
      console.log(`\n\n>>> ENCONTRADO! Usar: ${pageName} para página e ${sizeName} para tamanho <<<`);
      break;
    }
  }
}

main().catch(console.error);
