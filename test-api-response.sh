#!/bin/bash

echo "=== TESTANDO RESPOSTA DO ENDPOINT /api/shipments ==="
echo ""
echo "Nota: Este teste requer que você esteja autenticado."
echo "Execute o npm run dev e acesse /shipments no navegador primeiro,"
echo "depois copie o cookie de sessão e adicione aqui."
echo ""
echo "Para pegar o cookie:"
echo "1. Abra /shipments no navegador"
echo "2. Abra DevTools > Network"
echo "3. Encontre a requisição para /api/shipments"
echo "4. Copie o header 'Cookie'"
echo ""
echo "Exemplo de uso:"
echo "  Cookie='session=...' ./test-api-response.sh"
echo ""

if [ -z "$Cookie" ]; then
  echo "⚠️  Variável Cookie não definida."
  echo "Execute: Cookie='seu-cookie-aqui' ./test-api-response.sh"
  exit 1
fi

echo "Fazendo requisição..."
curl -s -H "Cookie: $Cookie" http://localhost:3000/api/shipments | \
  node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    const itemsWithDivergence = data.items.filter(i => i.hasVolumeDivergence);

    console.log('Total de items:', data.items.length);
    console.log('Items com hasVolumeDivergence:', itemsWithDivergence.length);
    console.log('');

    if (itemsWithDivergence.length > 0) {
      console.log('Detalhes dos items com divergência:');
      itemsWithDivergence.forEach(item => {
        console.log('  -', item.trackingCode);
        console.log('    hasVolumeDivergence:', item.hasVolumeDivergence);
        console.log('    typeof:', typeof item.hasVolumeDivergence);
        console.log('');
      });
    } else {
      console.log('⚠️  Nenhum item com hasVolumeDivergence encontrado!');
      console.log('');
      console.log('Exemplo de um item (para debug):');
      console.log(JSON.stringify(data.items[0], null, 2));
    }
  "
