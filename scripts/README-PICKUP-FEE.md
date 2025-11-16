# Sistema de Taxa de Coleta na Origem

## Visão Geral

Sistema de cobrança de taxa de coleta na origem para cotações, com seleção **automática** do coletor mais próximo do remetente.

## Regras de Negócio

### 1. Ativação da Coleta

- O toggle "Solicitar coleta na origem" está disponível em `/cotacoes`
- Quando ativado (`pickupAtOrigin = true`):
  - Em `/cotacoes/finalizar`, a taxa de coleta é calculada e exibida
  - O sistema **sempre identifica automaticamente** o coletor mais próximo
  - A taxa é adicionada ao total do serviço

### 2. Tipos de Taxa

Os coletores podem ter dois tipos de taxa de coleta:

**FIXED (Taxa Fixa)**:
- Valor fixo cobrado independentemente da distância
- Exemplo: R$ 15,00 por coleta

**PER_KM (Taxa por Km)**:
- Valor por quilômetro calculado com base na distância
- Exemplo: R$ 2,50/km × 10 km = R$ 25,00

### 3. Seleção Automática do Coletor

O sistema **sempre** seleciona o coletor mais próximo:

1. Obtém CEP de origem (remetente)
2. Busca todos os coletores ATIVOS com CEPs cadastrados
3. Usa PostGIS para calcular distância precisa (ST_Distance com geography WGS84)
4. Coordenadas vêm de `cep_locations` (cache de geocoding)
5. Seleciona o coletor com menor distância via KNN search
6. Aplica a regra de cobrança configurada para esse coletor (FIXED ou PER_KM)

**Não há seleção manual** - a escolha é sempre baseada em proximidade geográfica precisa.

## Modelo de Dados

### Collector

Campos relacionados à taxa de coleta no modelo `Collector`:

```typescript
model Collector {
  // ... campos existentes ...

  // CEPs (fonte das coordenadas via cep_locations)
  pfCep              String?       // CEP PF
  pjCep              String?       // CEP PJ

  // Configuração de taxa de coleta
  pickupFeeType      PickupFeeType @default(FIXED)
  pickupFixedFee     Float?        // Taxa fixa (BRL)
  pickupFeePerKm     Float?        // Taxa por km (BRL/km)
}

enum PickupFeeType {
  FIXED
  PER_KM
}
```

### Geocodificação via CEP

O sistema usa **apenas CEPs** para obter coordenadas:
- Coordenadas vêm da tabela `cep_locations` (cache de geocoding PostGIS)
- **PF**: Usa `pfCep` para buscar coordenadas
- **PJ**: Usa `pjCep` para buscar coordenadas
- **Prioridade**: O cálculo de distância usa CEP PF primeiro, depois CEP PJ
- **Não armazena** lat/lng no cadastro do coletor - sempre lookup via CEP

## Arquitetura

### Backend

**Serviço de Cálculo**: `lib/services/pickupFee.ts`
```typescript
calculatePickupFee(originCep: string, freightCost: number)
```
- Geocodifica origem
- Busca coletores ativos
- Calcula distâncias
- Retorna coletor mais próximo e taxa

**API Endpoint**: `app/api/pickup-fee/calculate/route.ts`
```
POST /api/pickup-fee/calculate
{
  "originCep": "58035-100",
  "freightCost": 50.00
}
```

### Frontend

**Hook**: `hooks/usePickupFee.ts`
```typescript
const { data } = usePickupFee(originCep, freightCost, enabled);
```

**Componente**: `components/quote/LabelPreview.tsx`
- Exibe resumo do serviço
- Mostra taxa de coleta quando aplicável
- Total = Frete + Taxa de coleta

**Página**: `app/(dashboard)/cotacoes/finalizar/page.tsx`
- Usa `usePickupFee` quando `pickupAtOrigin = true`
- Passa informações para `LabelPreview`
- Inclui taxa no payload de checkout

## Scripts Utilitários

### 1. Geocodificação de CEPs de Coletores

```bash
DATABASE_URL="postgresql://user:pass@host:port/db" npx tsx scripts/geocode-collectors.ts
```

Geocodifica automaticamente CEPs de coletores:
- Popula tabela `cep_locations` com coordenadas de `pfCep` e `pjCep`
- Não armazena coordenadas no cadastro do coletor (usa cache PostGIS)
- Exibe precisão do geocoding (address, zipcode, city, city_fallback, state_fallback)

### 2. Teste de Cálculo de Taxa

```bash
DATABASE_URL="postgresql://user:pass@host:port/db" npx tsx scripts/test-pickup-fee-calculation.ts
```

Simula cálculo de taxa:
- Teste com CEP de origem em João Pessoa/PB (58035-100)
- Usa PostGIS para calcular distâncias (ST_Distance)
- Exibe qual coletor seria selecionado
- Mostra simulação de cotação completa com precisão do geocoding
- Avisa sobre imprecisões (city_fallback, state_fallback)

## Fluxo Completo

### 1. Usuário faz cotação com coleta ativa

```
/cotacoes → Toggle "Solicitar coleta na origem" ativado
↓
pickupAtOrigin = true (salvo em quoteDraft)
```

### 2. Finalização da cotação

```
/cotacoes/finalizar
↓
usePickupFee(originCep, freightCost, pickupAtOrigin)
↓
POST /api/pickup-fee/calculate
↓
calculatePickupFee(originCep, freightCost)
↓
Retorna: { collector, distanceKm, feeAmount, totalWithPickup }
```

### 3. Exibição no resumo

```
LabelPreview recebe pickupFee:
- Transportadora: J&T Express
- Serviço: J&T Economy
- Prazo: 12 dias úteis
- Preço do frete: R$ 50,00

--- Coleta na origem ---
- Coletor: João Silva (Silva Transportes)
- Distância: 23.5 km
- Taxa de coleta: R$ 58,75

--- Total (frete + coleta) ---
R$ 108,75
```

### 4. Checkout

O payload de checkout inclui:

```json
{
  "freightCost": 50.00,
  "totalCost": 108.75,
  "pickupFee": {
    "collectorId": "...",
    "feeAmount": 58.75,
    "distanceKm": 23.5
  }
}
```

## Cenários de Teste

### Cenário 1: Coleta desativada
- `pickupAtOrigin = false`
- Não calcula taxa de coleta
- Resumo mostra apenas preço do frete
- Total = Frete

### Cenário 2: Coleta ativada + Taxa FIXA
- `pickupAtOrigin = true`
- Coletor mais próximo tem `pickupFeeType = FIXED`
- Taxa = `pickupFixedFee` (ex: R$ 15,00)
- Total = Frete + 15,00

### Cenário 3: Coleta ativada + Taxa POR_KM
- `pickupAtOrigin = true`
- Coletor mais próximo tem `pickupFeeType = PER_KM`
- Taxa = distância × `pickupFeePerKm` (ex: 23.5 km × R$ 2,50/km = R$ 58,75)
- Total = Frete + 58,75

### Cenário 4: Múltiplos coletores
- Sistema calcula distância para TODOS os coletores ativos
- Seleciona o mais próximo **independentemente do tipo de taxa**
- Exemplo: Coletor A (10 km, taxa R$ 50,00) é escolhido ao invés de Coletor B (15 km, taxa R$ 30,00)

## Geocodificação

### Sistema PostGIS (Nova Arquitetura)

**Serviço centralizado**: `lib/services/postgis.ts`

- Usa PostGIS (ST_Distance com geography WGS84) para precisão métrica
- Coordenadas armazenadas **apenas** em `cep_locations` (cache)
- Geocoding em camadas com fallback:
  1. **address**: Endereço completo (mais preciso)
  2. **zipcode**: Centro do CEP
  3. **city**: Centro da cidade
  4. **city_fallback**: Centro da cidade (alternativa)
  5. **state_fallback**: Capital do estado (menos preciso)

### CEP de Origem

- Lookup em `cep_locations` via `getCoordinatesForCep()`
- BrasilAPI para buscar dados do CEP
- OpenStreetMap Nominatim para coordenadas
- Re-geocoding automático para entradas com baixa precisão (>7 dias)

### CEP de Coletores

- Usa `pfCep` e `pjCep` como identificadores geográficos
- Coordenadas obtidas via lookup em `cep_locations`
- **Não armazena** lat/lng no model Collector
- Script `geocode-collectors.ts` popula cache para CEPs de coletores

## Próximos Passos

### Implementação no Admin

Pendente: Adicionar geocodificação automática em `/admin/coletores` ao criar/editar coletores.

Funcionalidades desejadas:
- Auto-preencher lat/lng ao salvar com CEP
- Botão manual "Geocodificar" para re-geocodificar
- Exibir coordenadas em campos read-only
- Preview do mapa ao editar coletor

### Melhorias

1. **Cobertura por região**: Filtrar coletores por UF/cidade antes de calcular distâncias
2. **Capacidade**: Verificar `capacityPerDay` antes de selecionar coletor
3. **Horários**: Adicionar janelas de horário de coleta
4. **Notificações**: Notificar coletor quando for atribuído a uma coleta
5. **Dashboard**: Exibir métricas de coletas por coletor

## Referências

- **PostGIS Distance**: `lib/services/postgis.ts` (ST_Distance, KNN search)
- **Distance Service**: `lib/services/distance.ts` (validação e precisão)
- **Pickup Fee Calculation**: `lib/services/pickupFee.ts`
- **Hook React**: `hooks/usePickupFee.ts`
- **Testes**: `scripts/test-pickup-fee-calculation.ts`
- **Geocoding Scripts**: `scripts/geocode-collectors.ts`
