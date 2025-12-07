/**
 * Testa a busca de agências dos Correios
 */

import { listarAgencias, listarTodasAgencias } from '../lib/correios/agencia-client';

async function main() {
  console.log('=== Teste de Agências dos Correios ===\n');

  // Teste 1: Buscar apenas primeira página
  console.log('--- Teste 1: Primeira página (50 itens) ---');
  try {
    const resultado = await listarAgencias({
      uf: 'PB',
      status: 2,
      pagina: 0,
      quantidade: 50,
    });
    console.log('Resultado:', {
      itens: resultado.itens?.length || 0,
      pagina: resultado.pagina,
      quantidade: resultado.quantidade,
      totalRegistros: resultado.totalRegistros,
      totalPaginas: resultado.totalPaginas,
    });

    if (resultado.itens?.length > 0) {
      console.log('Primeira agência:', resultado.itens[0].nome);
      console.log('Última agência:', resultado.itens[resultado.itens.length - 1].nome);
    }
  } catch (error) {
    console.error('Erro no teste 1:', error);
  }

  // Teste 2: Buscar página 1
  console.log('\n--- Teste 2: Segunda página (página 1) ---');
  try {
    const resultado = await listarAgencias({
      uf: 'PB',
      status: 2,
      pagina: 1,
      quantidade: 50,
    });
    console.log('Resultado:', {
      itens: resultado.itens?.length || 0,
      pagina: resultado.pagina,
      quantidade: resultado.quantidade,
      totalRegistros: resultado.totalRegistros,
      totalPaginas: resultado.totalPaginas,
    });

    if (resultado.itens?.length > 0) {
      console.log('Primeira agência:', resultado.itens[0].nome);
      console.log('Última agência:', resultado.itens[resultado.itens.length - 1].nome);
    }
  } catch (error) {
    console.error('Erro no teste 2:', error);
  }

  // Teste 3: Buscar TODAS com paginação automática
  console.log('\n--- Teste 3: Todas as agências (paginação automática) ---');
  try {
    const agencias = await listarTodasAgencias({ uf: 'PB', status: 2 });
    console.log('Total de agências encontradas:', agencias.length);

    // Contar únicas
    const idsUnicos = new Set(agencias.map((a) => a.id));
    console.log('IDs únicos:', idsUnicos.size);

    // Listar algumas para ver se há duplicatas
    const nomes = agencias.map((a) => a.nome);
    const nomesUnicos = new Set(nomes);
    console.log('Nomes únicos:', nomesUnicos.size);

    if (agencias.length !== nomesUnicos.size) {
      console.log('\nPossíveis duplicatas encontradas!');
      // Mostrar duplicatas
      const contagem = new Map<string, number>();
      for (const nome of nomes) {
        contagem.set(nome, (contagem.get(nome) || 0) + 1);
      }
      for (const [nome, count] of contagem.entries()) {
        if (count > 1) {
          console.log(`  - "${nome}": ${count}x`);
        }
      }
    }
  } catch (error) {
    console.error('Erro no teste 3:', error);
  }
}

main().catch(console.error);
