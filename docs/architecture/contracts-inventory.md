# Inventário de Contratos Globais

**Versão**: 1.0.0
**Data**: 2025-01-28
**Status**: ✅ Ativo

## Objetivo

Este documento serve como fonte da verdade para todos os contratos (DTOs) e enums utilizados no sistema, tanto no frontend quanto no backend futuro.

## Localização

- **Contratos**: `/types/contracts.ts`
- **Validações**: `/types/validations.ts`

---

## Enums Globais

### ShipmentStatus
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum ShipmentStatus`

| Valor | Label | Cor (Ant Design) | Descrição |
|-------|-------|------------------|-----------|
| `criado` | Criado | default | Envio criado, aguardando emissão de etiqueta |
| `etiqueta_emitida` | Etiqueta Emitida | blue | Etiqueta gerada, aguardando postagem |
| `postado` | Postado | cyan | Objeto postado nos Correios/transportadora |
| `em_transporte` | Em Transporte | processing | Em rota de entrega |
| `entregue` | Entregue | success | Entregue ao destinatário |
| `cancelado` | Cancelado | error | Envio cancelado |

**Uso**: Tabelas de envios, detalhes de rastreamento, filtros

---

### CollectionStatus
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum CollectionStatus`

| Valor | Label | Cor (Ant Design) | Descrição |
|-------|-------|------------------|-----------|
| `aberta` | Aberta | default | Coleta criada, aguardando agendamento |
| `agendada` | Agendada | blue | Coleta agendada com data/hora |
| `em_andamento` | Em Andamento | processing | Transportadora a caminho |
| `concluida` | Concluída | success | Coleta realizada com sucesso |
| `cancelada` | Cancelada | error | Coleta cancelada |

**Uso**: Tabela de coletas, filtros, dropdown de status

---

### SupportStatus
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum SupportStatus`

| Valor | Label | Cor (Ant Design) | Descrição |
|-------|-------|------------------|-----------|
| `aberto` | Aberto | error | Ticket aberto, aguardando atendimento |
| `em_atendimento` | Em Atendimento | processing | Suporte trabalhando no ticket |
| `resolvido` | Resolvido | success | Problema resolvido |
| `fechado` | Fechado | default | Ticket encerrado |

**Uso**: Lista de tickets, filtros, timeline

---

### SupportPriority
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum SupportPriority`

| Valor | Label | Cor (Ant Design) | Descrição |
|-------|-------|------------------|-----------|
| `baixa` | Baixa | default | Prioridade baixa |
| `media` | Média | blue | Prioridade média |
| `alta` | Alta | warning | Prioridade alta |
| `critica` | Crítica | error | Crítica - SLA reduzido |

**Uso**: Badge de prioridade, filtros, ordenação

---

### PickupPointStatus
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum PickupPointStatus`

| Valor | Label | Cor (Ant Design) | Descrição |
|-------|-------|------------------|-----------|
| `active` | Ativo | success | Ponto de coleta ativo |
| `blocked` | Bloqueado | error | Ponto de coleta bloqueado |

**Uso**: Tabela de pontos de coleta, filtros

---

### UserStatus
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum UserStatus`

| Valor | Label | Cor (Ant Design) | Descrição |
|-------|-------|------------------|-----------|
| `active` | Ativo | success | Usuário ativo |
| `blocked` | Bloqueado | error | Usuário bloqueado |

**Uso**: Gestão de usuários, filtros

---

### AuthRole
**Arquivo**: `types/contracts.ts`
**Tipo**: `enum AuthRole`

| Valor | Label | Descrição |
|-------|-------|-----------|
| `admin` | Administrador | Acesso total ao sistema |
| `suporte` | Suporte | Gestão de tickets e atendimento |
| `operacoes` | Operações | Gestão de envios e coletas |
| `financeiro` | Financeiro | Gestão financeira |
| `gerente` | Gerente | Visão gerencial |

**Uso**: Controle de acesso, permissões

---

## Contratos (DTOs)

### Shipment
**Arquivo**: `types/contracts.ts`
**Interface**: `Shipment`

**Campos obrigatórios**:
- `id`: string (UUID)
- `trackingCode`: string (código de rastreio)
- `status`: ShipmentStatus
- `carrier`: string (transportadora)
- `service`: string (serviço/modalidade)
- `origin`: Address
- `destination`: Address
- `recipientName`: string
- `recipientPhone`: string
- `volumes`: Array<Volume>
- `freightValue`: number
- `etaDays`: number
- `createdAt`: string (ISO 8601)
- `updatedAt`: string (ISO 8601)

**Campos opcionais**:
- `recipientEmail`: string | null
- `insuranceValue`: number | null
- `expectedDeliveryDate`: string | null
- `postedAt`: string | null
- `deliveredAt`: string | null

**Usado em**:
- `/shipments` (lista)
- `/shipments/[id]` (detalhes)
- `/rastreamento/[id]`

---

### Collection
**Arquivo**: `types/contracts.ts`
**Interface**: `Collection`

**Campos obrigatórios**:
- `id`: string (UUID)
- `shipmentId`: string (referência ao envio)
- `status`: CollectionStatus
- `origin.name`: string
- `origin.phone`: string
- `origin.address`: Address
- `createdAt`: string (ISO 8601)
- `updatedAt`: string (ISO 8601)

**Campos opcionais**:
- `scheduledWindow`: string | null (ISO 8601 datetime)
- `carrier`: string | null
- `service`: string | null
- `notes`: string | null

**Usado em**:
- `/coletas` (lista)
- `/coletas/[id]` (detalhes)
- Store: `stores/coletas.ts`

---

### PickupPoint
**Arquivo**: `types/contracts.ts`
**Interface**: `PickupPoint`

**Campos obrigatórios**:
- `id`: string (UUID)
- `status`: PickupPointStatus
- `companyName`: string (razão social)
- `tradingName`: string (nome fantasia)
- `cnpj`: string
- `address`: Address
- `paymentMethod`: object
- `monthlyReceived`: number
- `createdAt`: string (ISO 8601)
- `updatedAt`: string (ISO 8601)

**Campos opcionais**:
- `stateRegistration`: string | null
- `email`: string | null
- `phone`: string | null
- `geo`: { lat, lng } | null
- `payoutDay`: number | null
- `minPayoutAmount`: number | null
- `commissionPerItem`: number | null
- `capacityPerDay`: number | null

**Usado em**:
- `/admin/pontos-de-coleta` (CRUD)
- `/cotacoes/finalizar` (seleção)
- Store: `stores/pontos.ts`

---

### SupportTicket
**Arquivo**: `types/contracts.ts`
**Interface**: `SupportTicket`

**Campos obrigatórios**:
- `id`: string (UUID)
- `title`: string
- `description`: string
- `status`: SupportStatus
- `priority`: SupportPriority
- `category`: string
- `requester.name`: string
- `requester.email`: string
- `createdAt`: string (ISO 8601)
- `updatedAt`: string (ISO 8601)

**Campos opcionais**:
- `requester.phone`: string | null
- `requester.userId`: string | null
- `linkedTrackingCode`: string | null
- `assigneeUserId`: string | null
- `slaDueAt`: string | null

**Usado em**:
- `/suporte` (lista cliente)
- `/admin/suporte` (lista admin)
- `/suporte/[id]` (detalhes)
- Store: `stores/support.ts`

---

### SupportMessage
**Arquivo**: `types/contracts.ts`
**Interface**: `SupportMessage`

**Campos obrigatórios**:
- `id`: string (UUID)
- `ticketId`: string
- `author`: "cliente" | "suporte"
- `authorName`: string
- `content`: string
- `createdAt`: string (ISO 8601)

**Campos opcionais**:
- `attachments`: Array<Attachment>

**Usado em**:
- `/suporte/[id]` (comentários)
- `/admin/suporte/[id]` (respostas)

---

### User
**Arquivo**: `types/contracts.ts`
**Interface**: `User`

**Campos obrigatórios**:
- `id`: string (UUID)
- `name`: string
- `email`: string
- `status`: UserStatus
- `roles`: AuthRole[]
- `createdAt`: string (ISO 8601)
- `updatedAt`: string (ISO 8601)

**Campos opcionais**:
- `phone`: string | null
- `lastLoginAt`: string | null

**Usado em**:
- `/admin/usuarios` (gestão)
- Autenticação e autorização

---

## Validações (Zod)

Todas as validações estão centralizadas em `/types/validations.ts`:

- `shipmentStatusSchema`
- `collectionStatusSchema`
- `supportStatusSchema`
- `supportPrioritySchema`
- `pickupPointStatusSchema`
- `userStatusSchema`
- `authRoleSchema`
- `addressSchema`
- `emailSchema`
- `phoneSchema`
- `cnpjSchema`
- `cpfSchema`
- `documentSchema`
- `collectionFormSchema`
- `supportTicketFormSchema`
- `userFormSchema`

**Uso**: Validação de formulários com React Hook Form + Zod Resolver

---

## Utilitários

### Labels e Cores

Todos os enums têm mapeamentos de labels e cores:

```typescript
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
  COLLECTION_STATUS_LABELS,
  COLLECTION_STATUS_COLORS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_COLORS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITY_COLORS,
  USER_STATUS_LABELS,
  USER_STATUS_COLORS,
  AUTH_ROLE_LABELS,
} from "@/types/contracts";
```

**Uso**: Tags, badges, filtros, legendas

---

## Migração

### Status Atual

- ✅ Contratos criados em `/types/contracts.ts`
- ✅ Validações centralizadas em `/types/validations.ts`
- ✅ Inventário documentado
- 🔄 Em progresso: Atualização de componentes para usar contratos

### Próximos Passos

1. Atualizar stores (coletas, suporte, pontos) para usar enums
2. Atualizar componentes de tabela para usar labels/cores padronizadas
3. Atualizar formulários para usar schemas centralizados
4. Remover tipos duplicados/ambíguos

---

## Changelog

### v1.0.0 - 2025-01-28
- Criação inicial dos contratos globais
- Definição de todos os enums
- Criação de schemas Zod centralizados
- Documentação do inventário

---

## Notas

- Todos os timestamps devem usar formato ISO 8601
- UUIDs devem ser gerados com `crypto.randomUUID()`
- CEPs devem ser armazenados com hífen: `00000-000`
- Telefones devem ter no mínimo 10 dígitos
- Status e prioridades são case-sensitive (lowercase com underscores)
