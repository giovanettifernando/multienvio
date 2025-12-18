# Resumo da Padronização de Status de Envios

## 📊 Situação Atual da Implementação

### ✅ Concluído

#### 1. **Análise e Mapeamento (Passo 1)**
- ✅ Mapeamento completo dos status atuais documentado em `status-migration-analysis.md`
- ✅ Identificados 10 status antigos no banco
- ✅ Proposta de 34 status novos organizados por fase
- ✅ Quadro de mapeamento legacy → novo criado

#### 2. **Enum Padronizado (Passo 2)**
- ✅ Arquivo: `lib/shipments/shipment-status.ts`
- ✅ Enum `ShipmentStatus` com 34 status organizados por fase:
  - Fase A - Origem: 11 status (coleta + ponto de coleta)
  - Fase B - Transporte: 5 status
  - Fase C - Entrega e Problemas: 4 status
  - Fase D - Cancelamento e Retorno: 8 status
- ✅ Constantes auxiliares:
  - `StatusPhases` - Agrupamento por fase
  - `CANCELLABLE_BEFORE_HANDOFF` - Status canceláveis antes da transportadora
  - `CANCELLABLE_IN_TRANSIT` - Status canceláveis em trânsito
  - `FINAL_STATUSES` - Status finais (imutáveis)
- ✅ Mapeamentos de labels e cores para UI

#### 3. **Utilitários de Migração (Passo 2)**
- ✅ Arquivo: `lib/shipments/status-migration.ts`
- ✅ Função `migrateLegacyStatus()` - Migra status antigos para novos com contexto
- ✅ Função `canBeCancelled()` - Verifica se status permite cancelamento
- ✅ Função `getNextCancellationStatus()` - Determina próximo status de cancelamento
- ✅ Função `getInitialShipmentStatus()` - Define status inicial no checkout
- ✅ Funções de fluxo de cancelamento (before_handoff / in_transit)

#### 4. **Labels e Mapeamento UI (Passo 2)**
- ✅ Arquivo: `lib/shipments/status-labels-map.ts`
- ✅ Tipo `UIShipmentStatus` - 8 status simplificados para frontend
- ✅ Função `mapToUIStatus()` - Mapeia status completo → status simplificado UI
- ✅ Função `getStatusLabel()` - Retorna label em PT-BR
- ✅ Função `getBackendStatusesForUIFilter()` - Mapeia filtro UI → status backend

#### 5. **Schema Prisma (Passo 3)**
- ✅ Atualizado default do campo `status` de `"criado"` para `"PICKUP_REQUESTED"`
- ✅ Adicionado comentário de documentação indicando padrão ShipmentStatus
- ✅ Campo mantido como `String` para flexibilidade (TypeScript faz validação)

#### 6. **Migração de Banco de Dados (Passo 3)**
- ✅ Arquivo: `prisma/migrations/20251119000000_status_standardization/migration.sql`
- ✅ Migração SQL completa com:
  - Backup temporário dos status atuais
  - Mapeamento de todos os status antigos → novos
  - Lógica condicional para status 'criado' e 'cancelled'
  - Reindex de índices
  - Relatório de migração com estatísticas

#### 7. **Scripts de Suporte (Passo 3)**
- ✅ Arquivo: `scripts/preview-status-migration.ts`
  - Preview da migração antes de aplicar
  - Mostra distribuição atual e simulação
  - Identifica possíveis problemas
- ✅ Arquivo: `scripts/verify-status-migration.ts`
  - Verificação pós-migração
  - Valida status inválidos
  - Estatísticas de distribuição final
  - Integridade com PickupRequest e Pontos de Coleta

#### 8. **Serviço de Criação de Shipments (Passo 4)**
- ✅ Arquivo: `lib/shipments/create-with-volumes.ts` atualizado
- ✅ Usa `getInitialShipmentStatus()` para determinar status inicial
- ✅ Lógica: se tem pickup point → `AWAITING_DROP_OFF_AT_POINT`, senão → `PICKUP_REQUESTED`

#### 9. **Endpoint /api/shipments (Passo 4)**
- ✅ Arquivo: `app/api/shipments/route.ts` atualizado
- ✅ Removido `STATUS_MAP` antigo
- ✅ Importa funções de `status-labels-map.ts`
- ✅ Filtro de status usa `getBackendStatusesForUIFilter()`
- ✅ Resposta usa `mapToUIStatus()` para compatibilidade com frontend

#### 10. **Endpoint de Cancelamento (Passo 4)**
- ✅ Arquivo: `app/api/shipments/[id]/cancel/route.ts` atualizado
- ✅ Importa `ShipmentStatus`, `FINAL_STATUSES`, `canBeCancelled`, `getNextCancellationStatus`
- ✅ Valida se está em status final (impede cancelamento)
- ✅ Valida se pode ser cancelado no status atual
- ✅ Determina próximo status: `CANCELLATION_REQUESTED_BEFORE_HANDOFF` ou `CANCELLATION_REQUESTED_IN_TRANSIT`
- ✅ Retorna mensagens diferentes conforme tipo de cancelamento

#### 11. **Conectar com /coletores (Passo 5)** ✅
- ✅ Arquivo: `app/api/coletores/coletas/[id]/agendar/route.ts` atualizado
  - Agendamento atualiza Shipment.status → `PICKUP_SCHEDULED`
  - PickupRequest.status → `SCHEDULED`
- ✅ Arquivo: `app/api/coletores/coletas/[id]/registrar/route.ts` atualizado
  - Coleta realizada atualiza Shipment.status → `COLLECTED_FROM_SENDER`
  - PickupRequest.status → `COMPLETED`
- ✅ Arquivo: `app/api/coletores/coletas/[id]/registrar-tentativa/route.ts` atualizado
  - Após 3 tentativas falhas → Shipment.status = `PICKUP_FAILED`
  - PickupRequest.status → `FAILED`
- ✅ Todas as atualizações usam transações para garantir consistência
- ✅ Shipment.status é a source of truth do estado logístico

#### 12. **Conectar com /collectors (Passo 6)** ✅
- ✅ Arquivo: `app/api/collector/receptions/route.ts` atualizado
- ✅ Filtro de status pendentes atualizado para usar novos status:
  - `COLLECTED_FROM_SENDER`
  - `IN_TRANSIT_TO_CARRIER_HUB`
  - `DROPPED_OFF_AT_POINT`
  - `AWAITING_CARRIER_PICKUP_AT_POINT`
  - `COLLECTED_FROM_POINT`
  - `IN_TRANSFER`
  - `IN_TRANSIT_TO_DESTINATION`
- ✅ Importa `ShipmentStatus` enum

#### 13. **Handler de Integrações com Transportadoras (Passo 7)** ✅
- ✅ Arquivo: `lib/shipments/carrier-events-handler.ts` criado
- ✅ Tipo `CarrierEvent` definido com:
  - `eventCode`: Código do evento da transportadora
  - `description`: Descrição em português
  - `occurredAt`: Data/hora do evento
  - `location`: Cidade/Estado/País
  - `carrier`: Nome da transportadora
  - `notes`: Observações adicionais
- ✅ Função `mapCarrierEventToShipmentStatus()`:
  - Mapeia códigos de Correios (BDE, OEC, BDI, etc.)
  - Mapeia códigos de Jadlog (EMTRANSFERENCIA, ENTREGUE, etc.)
  - Fallback por descrição normalizada
  - Fallback por palavras-chave
- ✅ Função `applyCarrierEventToShipment()`:
  - Aplica evento a um shipment específico
  - Atualiza Shipment.status
  - Registra no histórico (preparado para tabela de tracking events)
  - Retorna sucesso/falha com mensagem
- ✅ Função `applyCarrierEventsBatch()` para processar múltiplos eventos
- ✅ Helpers de validação e normalização de eventos

#### 14. **Ajustar Frontend de /shipments (Passo 8)** ✅
- ✅ Arquivo: `src/types/shipments.ts` atualizado
  - Tipo `ShipmentStatus` alinhado com `UIShipmentStatus`
  - Adicionado "Aguardando postagem"
  - Adicionado "Devolvido"
  - Total de 8 status simplificados para UI
- ✅ Arquivo: `app/(dashboard)/shipments/page.tsx` atualizado
  - Array `STATUS_OPTIONS` inclui novos status
  - Objeto `STATUS_COLORS` define cores para todos os status
  - Lógica de cancelamento atualizada:
    - Status finais não podem ser cancelados: "Entregue", "Cancelado", "Devolvido"
    - Tooltip mostra "Não é possível cancelar" para status finais
    - Botão desabilitado e estilizado adequadamente

---

### 🚧 Pendente (Próximos Passos)

#### 15. **Executar Migração (Quando Aprovado)**
- ⏳ Executar preview: `DATABASE_URL="..." npx tsx scripts/preview-status-migration.ts`
- ⏳ Revisar output
- ⏳ Executar migração: `DATABASE_URL="..." npx prisma migrate deploy`
- ⏳ Executar verificação: `DATABASE_URL="..." npx tsx scripts/verify-status-migration.ts`
- ⏳ Monitorar logs e métricas pós-migração

#### 16. **Criar Endpoints para Pickup Points (Opcional/Futuro)**
- ⏳ `/api/collector/shipments/[id]/drop-off` - Marcar como entregue no ponto
  - Atualizar Shipment.status → `DROPPED_OFF_AT_POINT`
- ⏳ `/api/collector/shipments/[id]/carrier-pickup` - Transportadora coletou
  - Atualizar Shipment.status → `COLLECTED_FROM_POINT`

#### 17. **Integrar Handler de Eventos em Webhooks (Futuro)**
- ⏳ Atualizar `/api/webhooks/tracking` para usar `applyCarrierEventToShipment()`
- ⏳ Mapear eventos de cada transportadora para `CarrierEvent`
- ⏳ Processar eventos em batch quando possível

---

## 📁 Arquivos Criados

### Biblioteca Central
| Arquivo | Descrição |
|---------|-----------|
| `lib/shipments/shipment-status.ts` | Enum principal com 34 status, constantes, labels e cores |
| `lib/shipments/status-migration.ts` | Utilitários de migração e lógica de cancelamento |
| `lib/shipments/status-labels-map.ts` | Mapeamento UI ↔ Backend para compatibilidade |
| `lib/shipments/carrier-events-handler.ts` | **[NOVO]** Handler para eventos de transportadoras |

### Migração
| Arquivo | Descrição |
|---------|-----------|
| `prisma/migrations/20251119000000_status_standardization/migration.sql` | Migração SQL completa |
| `scripts/preview-status-migration.ts` | Preview antes da migração |
| `scripts/verify-status-migration.ts` | Verificação pós-migração |

### Documentação
| Arquivo | Descrição |
|---------|-----------|
| `status-migration-analysis.md` | Análise completa dos status atuais e proposta |
| `status-refactor-summary.md` | Este arquivo - resumo da implementação |

---

## 📁 Arquivos Modificados

### Backend - Core
| Arquivo | Mudanças |
|---------|----------|
| `prisma/schema.prisma` | Default do campo `status` atualizado + comentário |
| `lib/shipments/create-with-volumes.ts` | Usa `getInitialShipmentStatus()` |
| `app/api/shipments/route.ts` | Usa novo sistema de mapeamento |
| `app/api/shipments/[id]/cancel/route.ts` | Lógica de cancelamento atualizada |

### Backend - Coletores (Pickup)
| Arquivo | Mudanças |
|---------|----------|
| `app/api/coletores/coletas/[id]/agendar/route.ts` | **[NOVO]** Atualiza Shipment.status → `PICKUP_SCHEDULED` |
| `app/api/coletores/coletas/[id]/registrar/route.ts` | **[NOVO]** Atualiza Shipment.status → `COLLECTED_FROM_SENDER` |
| `app/api/coletores/coletas/[id]/registrar-tentativa/route.ts` | **[NOVO]** Após 3 tentativas → `PICKUP_FAILED` |

### Backend - Collectors (Pickup Points)
| Arquivo | Mudanças |
|---------|----------|
| `app/api/collector/receptions/route.ts` | **[NOVO]** Filtros de status atualizados para novos status |

### Frontend
| Arquivo | Mudanças |
|---------|----------|
| `src/types/shipments.ts` | **[NOVO]** Tipo `ShipmentStatus` alinhado com UIShipmentStatus (8 status) |
| `app/(dashboard)/shipments/page.tsx` | **[NOVO]** Filtros, cores e lógica de cancelamento atualizados |

---

## 🎯 Como Usar (Para Desenvolvedores)

### Criar um Novo Shipment
```typescript
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { getInitialShipmentStatus } from '@/lib/shipments/status-migration';

const status = getInitialShipmentStatus({
  hasPickupPoint: !!pickupPointId,
  hasPickupRequest: true,
});
// Retorna: PICKUP_REQUESTED ou AWAITING_DROP_OFF_AT_POINT
```

### Cancelar um Shipment
```typescript
import { canBeCancelled, getNextCancellationStatus } from '@/lib/shipments/status-migration';

if (canBeCancelled(currentStatus)) {
  const nextStatus = getNextCancellationStatus(currentStatus);
  // nextStatus será: CANCELLATION_REQUESTED_BEFORE_HANDOFF ou CANCELLATION_REQUESTED_IN_TRANSIT
}
```

### Mapear para UI
```typescript
import { mapToUIStatus } from '@/lib/shipments/status-labels-map';

const uiStatus = mapToUIStatus(ShipmentStatus.PICKUP_REQUESTED);
// Retorna: "Aguardando coleta"
```

### Filtrar por Status da UI
```typescript
import { getBackendStatusesForUIFilter } from '@/lib/shipments/status-labels-map';

const backendStatuses = getBackendStatusesForUIFilter("Aguardando coleta");
// Retorna: [PICKUP_REQUESTED, PICKUP_SCHEDULED, AWAITING_PICKUP_AT_ORIGIN]
```

### Processar Eventos de Transportadora
```typescript
import { applyCarrierEventToShipment, CarrierEvent } from '@/lib/shipments/carrier-events-handler';

const event: CarrierEvent = {
  eventCode: 'BDI',
  description: 'Objeto entregue ao destinatário',
  occurredAt: new Date(),
  carrier: 'correios',
  location: {
    city: 'São Paulo',
    state: 'SP',
  },
};

const result = await applyCarrierEventToShipment(shipmentId, event);
// result.success === true
// result.newStatus === ShipmentStatus.DELIVERED
```

---

## ⚠️ Importante

1. **Não executar a migração ainda**: Aguardar aprovação final
2. **Testar em ambiente de desenvolvimento**: Usar preview antes
3. **Backup do banco**: Fazer backup completo antes da migração
4. **Coordenação com equipe**: Avisar equipe antes de aplicar
5. **Monitoramento pós-migração**: Acompanhar logs e métricas

---

## 📊 Estatísticas

- **Status antigos**: 10
- **Status novos**: 34
- **Status UI simplificados**: 8
- **Arquivos criados**: 8 (incluindo carrier-events-handler.ts)
- **Arquivos modificados**: 10 (core + coletores + collectors + frontend)
- **Linhas de código**: ~2500+
- **Cobertura de fases**: 100% (A, B, C, D)
- **Integrações completas**:
  - ✅ Coletores (origem)
  - ✅ Collectors (pontos de coleta)
  - ✅ Transportadoras (handler pronto)
  - ✅ Frontend (tipos e filtros)

---

## 🔗 Próxima Ação Recomendada

### ✅ CONCLUÍDO - Todas as integrações implementadas!

1. ✅ **Enum padronizado criado** - 34 status organizados por fase
2. ✅ **Coletores integrados** - Endpoints de coleta atualizados
3. ✅ **Collectors integrados** - Filtros de recepção atualizados
4. ✅ **Handler de transportadoras criado** - Pronto para uso em webhooks
5. ✅ **Frontend atualizado** - Tipos, filtros e lógica de cancelamento

### 🚀 Próximos Passos (Quando Aprovado)

1. **Testar em desenvolvimento**:
   - Verificar se todos os endpoints estão funcionando
   - Testar fluxo completo: criação → coleta → entrega → cancelamento
   - Validar filtros e exibição na UI

2. **Executar migração**:
   ```bash
   # 1. Preview
   DATABASE_URL="..." npx tsx scripts/preview-status-migration.ts

   # 2. Aplicar migração
   DATABASE_URL="..." npx prisma migrate deploy

   # 3. Verificar
   DATABASE_URL="..." npx tsx scripts/verify-status-migration.ts
   ```

3. **Integrar handler de eventos**:
   - Adicionar `applyCarrierEventToShipment()` nos webhooks de rastreio
   - Mapear eventos de cada transportadora

4. **Deploy em produção**:
   - Backup do banco
   - Migração
   - Monitoramento
