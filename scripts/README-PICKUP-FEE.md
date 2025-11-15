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

1. Geocodifica o CEP de origem (remetente)
2. Busca todos os coletores ATIVOS com coordenadas válidas
3. Calcula a distância em km usando fórmula de Haversine
4. Seleciona o coletor com menor distância
5. Aplica a regra de cobrança configurada para esse coletor (FIXED ou PER_KM)

**Não há seleção manual** - a escolha é sempre baseada em proximidade.

## Modelo de Dados

### Collector

Campos adicionados ao modelo `Collector`:

```typescript
model Collector {
  // ... campos existentes ...

  // Coordenadas geográficas
  pfGeo              Json?         // { lat, lng } - PF
  pjGeo              Json?         // { lat, lng } - PJ

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

### Geocodificação Automática

O sistema geocodifica automaticamente:
- **PF**: Usa `pfCep` + endereço completo PF
- **PJ**: Usa `pjCep` + endereço completo PJ
- **Prioridade**: O cálculo de distância usa coordenadas PF primeiro, depois PJ

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

### 1. Diagnóstico de Coletores

```bash
DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/test-collectors-geo.js
```

Verifica:
- Quais coletores têm coordenadas válidas
- Status das configurações de taxa
- Resumo de cobertura

### 2. Geocodificação de Coletores

```bash
DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/geocode-collectors.js
```

Geocodifica automaticamente:
- Coletores sem coordenadas PF
- Coletores sem coordenadas PJ
- Usa BrasilAPI + OpenStreetMap Nominatim

### 3. Teste de Cálculo de Taxa

```bash
DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/test-pickup-fee-calculation.js
```

Simula cálculo de taxa:
- Teste com origem em João Pessoa/PB
- Calcula distâncias para todos os coletores
- Exibe qual seria selecionado
- Mostra simulação de cotação completa

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

### CEP de Origem

- Usa serviço centralizado: `lib/services/geocoding.ts`
- BrasilAPI para buscar endereço
- OpenStreetMap Nominatim para coordenadas
- Cache de 24 horas no frontend (React Query)

### CEP de Coletores

- Geocodifica PF e PJ separadamente
- Persiste em `pfGeo` e `pjGeo` (JSON)
- Script bulk para processar coletores existentes
- Aguarda 1 segundo entre requisições (rate limiting)

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

- **Fórmula de Haversine**: `lib/utils/geo.ts`
- **Geocodificação**: `lib/services/geocoding.ts`
- **Tipos TypeScript**: `lib/services/pickupFee.ts`
- **Hook React**: `hooks/usePickupFee.ts`
- **Testes**: `scripts/test-pickup-fee-calculation.js`
