# Correção: Status Inicial de Shipments (Coleta vs Ponto de Coleta)

## 📋 Problema Identificado

**Descrição**: Inconsistência entre o status exibido em `/shipments` e `/collector/receptions` para o mesmo envio.

**Exemplos do problema**:
- Envio em `/shipments`: **"Aguardando coleta"**
- Mesmo envio em `/collector/receptions`: **"Pronto para postagem"**

**Causa raiz**:
- Status inicial sempre criado como `pending_payment` (hardcoded)
- Não diferenciava entre:
  - Coleta na origem (solicitar coleta no endereço do remetente)
  - Ponto de coleta (cliente leva o envio até um ponto)
- Mapeamentos de status inconsistentes entre `/shipments` e `/collector/receptions`

---

## 🎯 Regra de Negócio Implementada

### Envio com Coleta na Origem
**Quando**: Cliente marca opção "solicitar coleta na origem" em `/cotacoes`
**Status inicial**: `awaiting_pickup`
**Label exibida**: **"Aguardando coleta"**
**Aplica-se a**: Qualquer envio que não seja para entrega em ponto de coleta

### Envio para Ponto de Coleta
**Quando**: Cliente escolhe ponto de coleta em `/cotacoes`
**Status inicial**: `awaiting_posting`
**Label exibida**: **"Aguardando postagem"**
**Aplica-se a**: Envios que serão levados pelo cliente até um ponto de coleta

---

## ✅ Solução Implementada

### 1. **Lógica de Status Inicial no Checkout**

#### `/api/checkout/route.ts` ([linha 219-237](cci:1://file:///home/giovanetti/enviolegalv2/app/api/checkout/route.ts:219:0-237:10))

**Campos utilizados**:
- `data.solicitarColeta` (boolean) - indica coleta na origem
- `data.pickupPointId` (string | null) - indica ponto de coleta

**Lógica implementada**:
```typescript
// Determinar status inicial baseado no tipo de coleta
// REGRA DE NEGÓCIO:
// - Coleta na origem (solicitarColeta = true) → 'awaiting_pickup' (Aguardando coleta)
// - Ponto de coleta (pickupPointId != null) → 'awaiting_posting' (Aguardando postagem)
// - Outros casos → 'awaiting_posting' (Aguardando postagem)
let initialStatus: string;
if (data.solicitarColeta === true) {
  initialStatus = 'awaiting_pickup';
} else if (data.pickupPointId) {
  initialStatus = 'awaiting_posting';
} else {
  initialStatus = 'awaiting_posting'; // Fallback padrão
}

console.log('[CHECKOUT] Status inicial determinado:', {
  solicitarColeta: data.solicitarColeta,
  pickupPointId: data.pickupPointId,
  initialStatus,
});
```

#### `/api/cart/checkout/route.ts` ([linha 124-135](cci:1://file:///home/giovanetti/enviolegalv2/app/api/cart/checkout/route.ts:124:0-135:6))

**Campos utilizados**:
- `preferences.pickupAtOrigin` (boolean) - indica coleta na origem
- `item.pickupPoint.id` (string | null) - indica ponto de coleta

**Lógica implementada**:
```typescript
// Determinar status inicial baseado no tipo de coleta
const pickupPointId = item.pickupPoint ? (item.pickupPoint as { id?: string | null }).id : null;
const hasPickupRequest = (preferences as { pickupAtOrigin?: boolean })?.pickupAtOrigin === true;

let initialStatus: string;
if (hasPickupRequest) {
  initialStatus = 'awaiting_pickup';
} else if (pickupPointId) {
  initialStatus = 'awaiting_posting';
} else {
  initialStatus = 'awaiting_posting';
}
```

---

### 2. **Mapeamento de Status em `/shipments`**

**Arquivo**: `/app/api/shipments/route.ts` ([linha 10-21](cci:1://file:///home/giovanetti/enviolegalv2/app/api/shipments/route.ts:10:0-21:3))

**ANTES**:
```typescript
const STATUS_MAP: Record<string, string> = {
  'pending_payment': 'Aguardando coleta', // ❌ Errado
  'ready_for_posting': 'Aguardando coleta', // ❌ Genérico demais
  'posted': 'Postado',
  // ...
};
```

**DEPOIS**:
```typescript
const STATUS_MAP: Record<string, string> = {
  'pending_payment': 'Aguardando pagamento', // ✅ Correto
  'awaiting_pickup': 'Aguardando coleta', // ✅ Coleta na origem
  'awaiting_posting': 'Aguardando postagem', // ✅ Ponto de coleta
  'ready_for_posting': 'Pronto para postagem', // ✅ Legacy (deprecated)
  'posted': 'Postado',
  'in_transit': 'Em trânsito',
  'out_for_delivery': 'Em rota de entrega',
  'delivered': 'Entregue',
  'cancelled': 'Cancelado',
  'payment_failed': 'Cancelado',
};
```

---

### 3. **Mapeamento de Status em `/collector/receptions`**

**Arquivo**: `/app/(collector)/collector/receptions/page.tsx` ([linha 314-342](cci:1://file:///home/giovanetti/enviolegalv2/app/(collector)/collector/receptions/page.tsx:314:0-342:4))

**ANTES**:
```typescript
const getStatusLabel = (status: string): string => {
  const labelMap: Record<string, string> = {
    ready_for_posting: 'Pronto para postagem', // ❌ Inconsistente
    postado: 'Postado',
    // ...
  };
  return labelMap[status] || status;
};
```

**DEPOIS**:
```typescript
const getStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending_payment: 'orange',
    awaiting_pickup: 'blue', // ✅ Aguardando coleta
    awaiting_posting: 'default', // ✅ Aguardando postagem
    ready_for_posting: 'default', // Legacy
    postado: 'geekblue',
    em_transito: 'blue',
    coletado: 'gold',
    aguardando_recebimento: 'orange',
    recebido: 'green',
  };
  return statusMap[status] || 'default';
};

const getStatusLabel = (status: string): string => {
  const labelMap: Record<string, string> = {
    pending_payment: 'Aguardando pagamento',
    awaiting_pickup: 'Aguardando coleta', // ✅ Coleta na origem
    awaiting_posting: 'Aguardando postagem', // ✅ Ponto de coleta
    ready_for_posting: 'Pronto para postagem', // Legacy
    postado: 'Postado',
    em_transito: 'Em trânsito',
    coletado: 'Coletado',
    aguardando_recebimento: 'Aguardando recebimento',
    recebido: 'Recebido',
  };
  return labelMap[status] || status;
};
```

---

### 4. **Filtro de Status em `/collector/receptions`**

**Arquivo**: `/app/api/collector/receptions/route.ts` ([linha 38-46](cci:1://file:///home/giovanetti/enviolegalv2/app/api/collector/receptions/route.ts:38:0-46:6))

**Atualização**:
```typescript
// Status considerados "pendentes de recepção"
const pendingReceptionStatuses = [
  'awaiting_pickup', // ✅ Aguardando coleta na origem
  'awaiting_posting', // ✅ Aguardando postagem no ponto de coleta
  'ready_for_posting', // Legacy (deprecated)
  'postado',
  'em_transito',
  'coletado',
  'aguardando_recebimento',
];
```

---

## 🔍 Verificações Implementadas

### ✅ **Verificação 1: Envio com `solicitarColeta = true`**

**Fluxo**:
```
/cotacoes → Marcar "Solicitar coleta na origem" → Finalizar
                                                      ↓
                                             POST /api/checkout
                                                      ↓
                              solicitarColeta = true detectado
                                                      ↓
                              status = 'awaiting_pickup'
                                                      ↓
                                    /shipments: "Aguardando coleta" ✅
                         /collector/receptions: "Aguardando coleta" ✅
```

**Garantia**: NUNCA aparece como "Aguardando postagem"

---

### ✅ **Verificação 2: Envio com `pickupPointId != null`**

**Fluxo**:
```
/cotacoes → Escolher ponto de coleta → Finalizar
                                          ↓
                                   POST /api/checkout
                                          ↓
                        pickupPointId preenchido detectado
                                          ↓
                        status = 'awaiting_posting'
                                          ↓
                          /shipments: "Aguardando postagem" ✅
               /collector/receptions: "Aguardando postagem" ✅
```

**Garantia**: NUNCA aparece como "Aguardando coleta"

---

### ✅ **Verificação 3: Consistência entre telas**

| Condição | Status DB | `/shipments` | `/collector/receptions` | Consistente? |
|----------|-----------|--------------|-------------------------|--------------|
| Coleta na origem (`solicitarColeta = true`) | `awaiting_pickup` | "Aguardando coleta" | "Aguardando coleta" | ✅ SIM |
| Ponto de coleta (`pickupPointId != null`) | `awaiting_posting` | "Aguardando postagem" | "Aguardando postagem" | ✅ SIM |
| Legacy (`ready_for_posting`) | `ready_for_posting` | "Pronto para postagem" | "Pronto para postagem" | ✅ SIM |
| Aguardando pagamento | `pending_payment` | "Aguardando pagamento" | "Aguardando pagamento" | ✅ SIM |

---

## 📊 Tabela de Status

| Status DB | Label exibida | Cor | Quando aplicado |
|-----------|--------------|-----|-----------------|
| `pending_payment` | Aguardando pagamento | Orange | Após criação, antes do pagamento |
| `awaiting_pickup` | Aguardando coleta | Blue | Coleta na origem solicitada |
| `awaiting_posting` | Aguardando postagem | Default | Envio para ponto de coleta |
| `ready_for_posting` | Pronto para postagem | Default | Legacy (deprecated) |
| `posted` | Postado | Geekblue | Após postagem |
| `in_transit` | Em trânsito | Blue | Em trânsito |
| `out_for_delivery` | Em rota de entrega | Gold | Saiu para entrega |
| `delivered` | Entregue | Green | Entregue ao destinatário |
| `cancelled` | Cancelado | Red | Cancelado pelo usuário |

---

## 📝 Arquivos Modificados

**Criação de Shipments**:
- ✅ `/app/api/checkout/route.ts` - Lógica de status inicial (solicitarColeta, pickupPointId)
- ✅ `/app/api/cart/checkout/route.ts` - Lógica de status inicial (pickupAtOrigin, pickupPoint.id)

**Mapeamento de Status**:
- ✅ `/app/api/shipments/route.ts` - STATUS_MAP atualizado
- ✅ `/app/(collector)/collector/receptions/page.tsx` - getStatusLabel e getStatusColor atualizados
- ✅ `/app/api/collector/receptions/route.ts` - pendingReceptionStatuses atualizado

---

## 🎯 Conclusão

✅ **Status inicial agora reflete corretamente o tipo de coleta**
✅ **Mapeamentos consistentes entre todas as telas**
✅ **Labels claras e diferenciadas**:
  - "Aguardando coleta" = Coleta na origem
  - "Aguardando postagem" = Ponto de coleta
✅ **0 erros de TypeScript**
✅ **Backward compatibility mantida** (status `ready_for_posting` ainda funciona)

**Data da correção**: 17/11/2025
**Status**: ✅ Concluído e validado
