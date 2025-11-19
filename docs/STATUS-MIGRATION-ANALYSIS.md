# Análise de Migração de Status - Shipments

## Status Atuais Encontrados

### 1. Status no Banco de Dados (Prisma Schema)
Campo `status` em `Shipment`: `String @default("criado")`

### 2. Status Mapeados em `/api/shipments/route.ts`

```typescript
const STATUS_MAP: Record<string, string> = {
  'pending_payment': 'Aguardando pagamento',
  'awaiting_pickup': 'Aguardando coleta', // Coleta na origem
  'awaiting_posting': 'Aguardando postagem', // Ponto de coleta
  'ready_for_posting': 'Pronto para postagem', // Legacy (deprecated)
  'posted': 'Postado',
  'in_transit': 'Em trânsito',
  'out_for_delivery': 'Em rota de entrega',
  'delivered': 'Entregue',
  'cancelled': 'Cancelado',
  'payment_failed': 'Cancelado',
};
```

### 3. Status no Frontend (`src/types/shipments.ts`)

```typescript
export type ShipmentStatus =
  | "Aguardando coleta"
  | "Postado"
  | "Em trânsito"
  | "Em rota de entrega"
  | "Entregue"
  | "Cancelado";
```

### 4. Status de PickupRequest

```
PENDING, SCHEDULED, FAILED, CANCELED, COMPLETED
```

### 5. Status Atual no Checkout

Default: `pending_payment` ou status fornecido

---

## Mapeamento para Novo Modelo

| Status Atual (DB) | Status Atual (UI) | Novo Status (Enum) | Fase | Notas |
|------------------|-------------------|-------------------|------|--------|
| `criado` | - | `AWAITING_DROP_OFF_AT_POINT` ou `PICKUP_REQUESTED` | A | Depende se tem pickup point |
| `pending_payment` | Aguardando pagamento | **OBSOLETO** | - | Não deve mais existir após checkout |
| `awaiting_pickup` | Aguardando coleta | `PICKUP_REQUESTED` | A | Fluxo 1: Coleta na origem |
| `awaiting_posting` | Aguardando postagem | `AWAITING_DROP_OFF_AT_POINT` | A | Fluxo 2: Ponto de coleta |
| `ready_for_posting` | Pronto para postagem | **OBSOLETO/DEPRECADO** | - | Legacy, será removido |
| `posted` | Postado | `RECEIVED_AT_ORIGIN_HUB` | A | Transportadora já tem o volume |
| `in_transit` | Em trânsito | `IN_TRANSIT_TO_DESTINATION` | B | Transporte |
| `out_for_delivery` | Em rota de entrega | `OUT_FOR_DELIVERY` | C | Mantém |
| `delivered` | Entregue | `DELIVERED` | C | Mantém |
| `cancelled` | Cancelado | `CANCELLED_BEFORE_HANDOFF` ou `CANCELLED_IN_TRANSIT_RETURNED` | D | Depende de quando foi cancelado |
| `payment_failed` | Cancelado | **OBSOLETO** | - | Não deve mais existir |

---

## Novos Status a Adicionar

### Fase A - Origem

**Fluxo 1: Coleta na origem**
- `PICKUP_REQUESTED` ✅ (já existe como `awaiting_pickup`)
- `PICKUP_SCHEDULED` ⭐ NOVO
- `AWAITING_PICKUP_AT_ORIGIN` ⭐ NOVO
- `PICKUP_FAILED` ⭐ NOVO
- `COLLECTED_FROM_SENDER` ⭐ NOVO
- `IN_TRANSIT_TO_CARRIER_HUB` ⭐ NOVO
- `RECEIVED_AT_ORIGIN_HUB` ✅ (já existe como `posted`)

**Fluxo 2: Ponto de coleta**
- `AWAITING_DROP_OFF_AT_POINT` ✅ (já existe como `awaiting_posting`)
- `DROPPED_OFF_AT_POINT` ⭐ NOVO
- `AWAITING_CARRIER_PICKUP_AT_POINT` ⭐ NOVO
- `COLLECTED_FROM_POINT` ⭐ NOVO

### Fase B - Transporte

- `IN_TRANSFER` ⭐ NOVO
- `IN_TRANSIT_TO_DESTINATION` ✅ (já existe como `in_transit`)
- `AT_DESTINATION_HUB` ⭐ NOVO
- `OUT_FOR_DELIVERY` ✅ (já existe)
- `AWAITING_PICKUP_AT_DESTINATION_HUB` ⭐ NOVO

### Fase C - Entrega

- `DELIVERED` ✅ (já existe)
- `DELIVERED_AT_DESTINATION_HUB` ⭐ NOVO
- `DELIVERY_ATTEMPT_FAILED` ⭐ NOVO
- `DELIVERY_PROBLEM` ⭐ NOVO

### Fase D - Cancelamento e Retorno

- `CANCELLATION_REQUESTED_BEFORE_HANDOFF` ⭐ NOVO
- `CANCELLED_BEFORE_HANDOFF` ⭐ NOVO (evolução de `cancelled`)
- `EXPIRED_NOT_POSTED` ⭐ NOVO
- `CANCELLATION_REQUESTED_IN_TRANSIT` ⭐ NOVO
- `CANCELLED_IN_TRANSIT_RETURNING` ⭐ NOVO
- `CANCELLED_IN_TRANSIT_RETURNED` ⭐ NOVO
- `RETURNING_TO_SENDER` ⭐ NOVO
- `RETURNED_TO_SENDER` ⭐ NOVO

---

## Estatísticas

- **Total de status atuais no DB:** 10
- **Total de status no novo modelo:** 34
- **Status obsoletos a remover:** 3 (`pending_payment`, `payment_failed`, `ready_for_posting`)
- **Status que serão mantidos:** 4 (`OUT_FOR_DELIVERY`, `DELIVERED`, `IN_TRANSIT_TO_DESTINATION`, `RECEIVED_AT_ORIGIN_HUB`)
- **Status a migrar com mudança:** 3 (`awaiting_pickup` → `PICKUP_REQUESTED`, `awaiting_posting` → `AWAITING_DROP_OFF_AT_POINT`, `cancelled` → múltiplos)
- **Novos status a adicionar:** 27

---

## Integração com PickupRequest

O status de `PickupRequest` continuará existindo separadamente, mas influenciará o status do `Shipment`:

| PickupRequest.status | Shipment.status (antes) | Shipment.status (depois) |
|---------------------|------------------------|-------------------------|
| PENDING | `awaiting_pickup` | `PICKUP_REQUESTED` |
| SCHEDULED | `awaiting_pickup` | `PICKUP_SCHEDULED` ou `AWAITING_PICKUP_AT_ORIGIN` |
| COMPLETED | `posted` (via coleta) | `COLLECTED_FROM_SENDER` → `IN_TRANSIT_TO_CARRIER_HUB` → `RECEIVED_AT_ORIGIN_HUB` |
| FAILED | - | `PICKUP_FAILED` |
| CANCELED | `cancelled` | `CANCELLED_BEFORE_HANDOFF` |

---

## Próximos Passos

1. ✅ Criar enum `ShipmentStatus` com todos os status
2. ✅ Atualizar schema Prisma
3. ✅ Criar migração de dados
4. ✅ Atualizar lógica de criação de shipments
5. ✅ Atualizar endpoints de /shipments
6. ✅ Conectar com /coletores
7. ✅ Conectar com /collectors
8. ✅ Preparar handler de integração
9. ✅ Atualizar frontend

