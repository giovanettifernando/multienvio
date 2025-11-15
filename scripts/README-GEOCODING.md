# Geocodificação de Pontos de Coleta

## Problema Identificado

O mapa de unidades no modal de seleção de pontos de coleta não estava exibindo marcadores porque os pontos de coleta cadastrados no banco de dados **não tinham coordenadas geográficas (latitude/longitude)** preenchidas.

## Solução Implementada

1. **Script de Diagnóstico** (`test-pickup-points-geo.js`):
   - Verifica quais pontos de coleta têm ou não coordenadas válidas
   - Útil para identificar rapidamente problemas de geolocalização

2. **Script de Correção Manual** (`fix-neoera-coords.js`):
   - Exemplo de como adicionar coordenadas manualmente a um ponto específico
   - Usado para corrigir o ponto "Neoera" em Curitiba/PR

3. **Script de Geocodificação Automática** (`geocode-pickup-points.js`):
   - Tenta geocodificar automaticamente usando ViaCEP + OpenStreetMap Nominatim
   - **Nota**: Pode falhar se houver problemas de rede ou rate limiting
   - Útil para processar múltiplos pontos de uma vez

## Como Usar

### 1. Verificar quais pontos precisam de coordenadas

```bash
DATABASE_URL="postgresql://envio:envio@localhost:5432/enviolegal?schema=public" node test-pickup-points-geo.js
```

### 2. Geocodificar automaticamente (se possível)

```bash
DATABASE_URL="postgresql://envio:envio@localhost:5432/enviolegal?schema=public" node scripts/geocode-pickup-points.js
```

### 3. Adicionar coordenadas manualmente (alternativa)

Se a geocodificação automática falhar, você pode:

1. **Buscar coordenadas manualmente**:
   - Use [Google Maps](https://www.google.com/maps) ou [OpenStreetMap](https://www.openstreetmap.org/)
   - Procure o endereço do ponto de coleta
   - Clique no local e copie as coordenadas (latitude, longitude)

2. **Atualizar no banco via Prisma**:

```javascript
// Exemplo: atualizar ponto específico
await prisma.pickupPoint.update({
  where: { id: 'ID_DO_PONTO' },
  data: {
    geo: {
      lat: -25.4284,  // Latitude
      lng: -49.2733,  // Longitude
    },
  },
});
```

3. **Ou via SQL direto**:

```sql
UPDATE "PickupPoint"
SET geo = '{"lat": -25.4284, "lng": -49.2733}'::jsonb
WHERE id = 'ID_DO_PONTO';
```

## Boas Práticas

1. **Sempre geocodifique novos pontos de coleta** ao cadastrá-los
2. **Valide as coordenadas** usando o script de diagnóstico
3. **Teste o mapa** após adicionar/atualizar pontos
4. **Mantenha backup** antes de executar scripts de atualização em massa

## Estrutura do Campo `geo`

O campo `geo` no banco de dados é do tipo `JSON` (ou `JSONB` no PostgreSQL) e deve ter a seguinte estrutura:

```json
{
  "lat": -25.4284,
  "lng": -49.2733
}
```

- `lat`: Latitude (número decimal, -90 a 90)
- `lng`: Longitude (número decimal, -180 a 180)

## Warnings no Console

Se um ponto de coleta aparecer na lista mas não no mapa, verifique o console do navegador. Você verá um warning como:

```
[MapModal] Ponto de coleta sem coordenadas válidas: {
  id: "...",
  name: "Nome do Ponto",
  cep: "80030-000",
  cidade: "Curitiba"
}
```

Isso indica que aquele ponto precisa ser geocodificado.

## Funcionalidades Implementadas

### ✅ Zoom Inteligente
- O mapa ajusta automaticamente o zoom para mostrar **TODOS** os pontos (origem + todos os pontos de coleta)
- Padding ajustado baseado na quantidade de pontos
- Zoom máximo de 13 quando há apenas 1 ponto próximo à origem
- Suporte para pontos em cidades/estados diferentes (ex: João Pessoa + Curitiba)

### ✅ Interação Mapa ↔ Lista
- Ao clicar em um item da lista, o mapa centraliza no marcador correspondente com animação suave
- Marcador do ponto selecionado é destacado visualmente (círculo azul maior)
- Ao clicar em um marcador no mapa, o ponto é selecionado e destacado na lista
- Scroll automático para o item selecionado na lista

### ✅ Tratamento de Múltiplos Pontos
- Se origem e ponto de coleta estão na mesma cidade, ambos aparecem no mapa
- Bounds calculados considerando TODOS os pontos visíveis
- Warning no console para pontos sem coordenadas válidas
- Filtro automático remove pontos inválidos antes de renderizar

## ✅ Geocodificação Automática Implementada

### Backend (Admin API)

**POST `/api/admin/pickup-points`** (Criar ponto):
- Quando um ponto é criado com CEP mas sem coordenadas, o sistema automaticamente geocodifica o CEP
- Usa BrasilAPI + OpenStreetMap Nominatim para obter lat/lng
- Se geocodificação falhar, o ponto é criado mesmo assim (coordenadas opcionais)
- Logs no console indicam sucesso/falha da geocodificação

**PATCH `/api/admin/pickup-points/[id]`** (Atualizar ponto):
- Geocodifica automaticamente quando:
  1. CEP foi alterado E coordenadas não foram fornecidas explicitamente
  2. OU coordenadas não existem e há CEP disponível
- Mesma lógica de fallback gracioso (não bloqueia atualização)

### Frontend (Calculadora)

**PostingUnitPicker.tsx**:
- Geocodifica o CEP de origem em tempo real usando hook `useGeocode`
- Prioriza coordenadas reais do CEP sobre coordenadas da capital do estado
- Cache de 24 horas (CEPs não mudam)
- Cálculo de distância preciso usando Haversine com coordenadas reais

**LeafletMapInner.tsx**:
- Zoom inteligente para incluir TODOS os pontos (origem + pontos de coleta)
- Centralização suave ao selecionar ponto na lista
- Marcador destacado para ponto selecionado

### Scripts Disponíveis

1. **`test-pickup-points-geo.js`**: Diagnóstico - verifica quais pontos têm coordenadas
2. **`geocode-all-points.js`**: Geocodifica em lote todos os pontos sem coordenadas
3. **`test-distance-calculations.js`**: Testa cálculo de distâncias (requer ambiente com fetch)
4. **`fix-*-coords.js`**: Scripts individuais para geocodificar pontos específicos

### Como Usar

**Criar novo ponto no admin:**
```typescript
POST /api/admin/pickup-points
{
  "nomeFantasia": "Ponto Exemplo",
  "cep": "01310-100",
  // ... outros campos
  // geo será preenchido automaticamente
}
```

**Atualizar CEP de ponto existente:**
```typescript
PATCH /api/admin/pickup-points/[id]
{
  "cep": "01310-200"
  // geo será atualizado automaticamente
}
```

**Geocodificar pontos existentes em lote:**
```bash
DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/geocode-all-points.js
```

## Melhorias Futuras

1. **Interface Admin**: Adicionar campos read-only para exibir lat/lng calculados
2. **Validação**: Opcional - tornar coordenadas obrigatórias ao criar novos pontos
3. **Visualização**: Mostrar preview do mapa ao editar ponto de coleta
4. **Marker Clustering**: Agrupar marcadores muito próximos para melhor visualização
5. **Retry Logic**: Implementar retry automático se geocodificação falhar temporariamente
