/**
 * Testa a paginação da API de agências dos Correios diretamente
 */

import 'dotenv/config';

const API_BASE = process.env.CORREIOS_API_BASE || 'https://apihom.correios.com.br';
const USUARIO = process.env.CORREIOS_USER;
const SENHA = process.env.CORREIOS_PASSWORD;
const CARTAO = process.env.CORREIOS_CARTAO_POSTAGEM;

console.log('Config:', {
  API_BASE,
  USUARIO: USUARIO ? '***' : 'não definido',
  SENHA: SENHA ? '***' : 'não definido',
  CARTAO: CARTAO || 'não definido',
});

async function getToken() {
  const credentials = Buffer.from(`${USUARIO}:${SENHA}`).toString('base64');

  const headers = {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  };

  if (CARTAO) {
    headers['numero-cartao-postagem'] = CARTAO;
  }

  console.log('Obtendo token...');

  const response = await fetch(`${API_BASE}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Auth failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log('Token obtido. Expira em:', data.expiraEm);
  return data.token;
}

async function testPagination(token) {
  const uf = 'PB';
  const quantidade = 50;

  console.log(`\nTestando paginação para UF=${uf}...`);

  let totalAgencias = 0;
  const agenciasUnicas = new Set();

  for (let pagina = 0; pagina < 200; pagina++) {
    const url = `${API_BASE}/agencia/v1/unidades?uf=${uf}&status=2&pagina=${pagina}&quantidade=${quantidade}`;

    console.log(`\n--- Página ${pagina} ---`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Erro HTTP: ${response.status} - ${text}`);
        break;
      }

      const data = await response.json();

      console.log('Resposta:', {
        itens: data.itens?.length || 0,
        pagina: data.pagina,
        quantidade: data.quantidade,
        totalRegistros: data.totalRegistros,
        totalPaginas: data.totalPaginas,
      });

      if (!data.itens || data.itens.length === 0) {
        console.log('\nSem mais itens.');
        break;
      }

      // Contar agências únicas
      for (const ag of data.itens) {
        agenciasUnicas.add(ag.id);
      }

      totalAgencias += data.itens.length;

      if (data.itens.length > 0) {
        console.log('Primeira:', data.itens[0].nome, '- ID:', data.itens[0].id);
        console.log('Última:', data.itens[data.itens.length - 1].nome, '- ID:', data.itens[data.itens.length - 1].id);
      }

      // Se página incompleta, é a última
      if (data.itens.length < quantidade) {
        console.log('\nPágina incompleta - fim da paginação.');
        break;
      }

      // Pequena pausa para não sobrecarregar
      await new Promise(r => setTimeout(r, 200));

    } catch (error) {
      console.error('Erro:', error.message);
      break;
    }
  }

  console.log('\n========================================');
  console.log(`Total de agências recebidas: ${totalAgencias}`);
  console.log(`Agências únicas (por ID): ${agenciasUnicas.size}`);
  console.log('========================================');
}

async function main() {
  try {
    const token = await getToken();
    await testPagination(token);
  } catch (error) {
    console.error('Erro fatal:', error);
  }
}

main();
