/**
 * Testa page/size na API de agências dos Correios
 */

import { correiosFetch } from '../lib/integrations/correios/client';

async function main() {
  console.log('=== Testando paginação com page/size ===\n');

  // Testar 3 páginas diferentes
  for (let page = 0; page <= 2; page++) {
    const url = `/agencia/v1/unidades?uf=PB&status=2&size=10&page=${page}`;
    console.log(`\n--- Página ${page} ---`);
    console.log('URL:', url);

    try {
      const response = await correiosFetch<{ itens: Array<{ id: string; nome: string }> }>(url, { method: 'GET' });

      if (response.itens?.length > 0) {
        console.log(`Itens: ${response.itens.length}`);
        console.log('Primeiro:', response.itens[0].id, '-', response.itens[0].nome);
        console.log('Último:', response.itens[response.itens.length - 1].id, '-', response.itens[response.itens.length - 1].nome);
      } else {
        console.log('Sem itens');
      }
    } catch (error) {
      console.error('Erro:', error instanceof Error ? error.message : error);
    }
  }
}

main().catch(console.error);
