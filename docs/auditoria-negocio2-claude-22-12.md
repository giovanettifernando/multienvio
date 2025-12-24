 AUDITORIA DE REGRAS DE NEGÓCIO — ENVIO LEGAL v2

  ENTREGÁVEL 1 — MAPA DO DOMÍNIO (Entidades e Invariantes)

  1.1 Entidades Principais

  | Entidade           | Invariantes Declaradas                                 | Código de Enforcement                                    | Status                                 |
  |--------------------|--------------------------------------------------------|----------------------------------------------------------|----------------------------------------|
  | User               | 1 carteira por usuário (userId @unique em Wallet)      | prisma/schema.prisma:436                                 | ✅ ENFORCED (DB constraint)             |
  | Wallet             | availableCents >= 0 (saldo nunca negativo)             | modules/wallet/application/wallet.service.ts:181         | ⚠️ PARCIAL (app-only, sem CHECK no DB) |
  | Wallet             | Débito requer FOR UPDATE lock antes de verificar saldo | modules/wallet/application/debit.service.ts:143-152      | ✅ ENFORCED                             |
  | WalletTransaction  | referenceId único para idempotência                    | prisma/schema.prisma:455                                 | ✅ ENFORCED (DB constraint)             |
  | Shipment           | platformTrackingCode único                             | prisma/schema.prisma:181                                 | ✅ ENFORCED (DB constraint)             |
  | Shipment           | Status deve seguir máquina de estados ShipmentStatus   | modules/shipments/application/shipment-status.ts         | ❌ NÃO ENFORCED                         |
  | Shipment           | Só pode cancelar se status em CANCELLABLE_*            | modules/shipments/application/status-migration.ts:97-101 | ⚠️ PARCIAL (só no endpoint user)       |
  | Label              | 1 label por shipment (shipmentId @unique)              | prisma/schema.prisma:239                                 | ✅ ENFORCED (DB constraint)             |
  | Label              | isPrinted só pode ir false→true (monotônico)           | Não existe enforcement                                   | ❌ NÃO ENFORCED                         |
  | Label              | Só pode baixar PDF se shipment está pago               | Não existe enforcement                                   | ❌ NÃO ENFORCED                         |
  | Package            | (shipmentId, packageNumber) único                      | prisma/schema.prisma:294                                 | ✅ ENFORCED (DB constraint)             |
  | Quote              | Expiração verificada antes de checkout                 | modules/cart/application/checkout.service.ts:200         | ✅ ENFORCED                             |
  | Quote              | Preço vem do servidor, não do cliente                  | modules/cart/application/checkout.service.ts:414-418     | ✅ ENFORCED                             |
  | PickupRequest      | 1 pickup por shipment (shipmentId @unique)             | prisma/schema.prisma:307                                 | ✅ ENFORCED (DB constraint)             |
  | Reception          | trackingCode único                                     | prisma/schema.prisma:561                                 | ✅ ENFORCED (DB constraint)             |
  | PaymentTransaction | referenceId único                                      | prisma/schema.prisma:782                                 | ✅ ENFORCED (DB constraint)             |

  1.2 Invariantes Críticas NÃO Enforced

  | Invariante                           | Onde Deveria Estar                             | Impacto                                  |
  |--------------------------------------|------------------------------------------------|------------------------------------------|
  | Wallet.availableCents >= 0           | prisma/schema.prisma como CHECK constraint     | Race condition pode gerar saldo negativo |
  | Transições de ShipmentStatus válidas | isValidTransition() em status-migration.ts:158 | Qualquer status pode ser setado          |
  | isPrinted monotônico                 | app/api/labels/[id]/route.ts:280               | Pode reverter impressão                  |
  | PDF só se pago                       | app/api/packages/[id]/pdf/route.ts             | Pode baixar PDF de envio não pago        |

  ---
  ENTREGÁVEL 2 — STATE MACHINES

  2.1 ShipmentStatus State Machine

  Fonte: modules/shipments/application/shipment-status.ts:9-119

  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                           FASE A - ORIGEM                                        │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                   │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │ PICKUP_REQUESTED   │───────→│ PICKUP_SCHEDULED   │                          │
  │   └────────────────────┘        └────────────────────┘                          │
  │            │                              │                                       │
  │            ▼                              ▼                                       │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │AWAITING_PICKUP_AT  │◄───────│   PICKUP_FAILED    │                          │
  │   │     _ORIGIN        │        └────────────────────┘                          │
  │   └────────────────────┘                                                         │
  │            │                                                                      │
  │            ▼                                                                      │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │COLLECTED_FROM_     │───────→│IN_TRANSIT_TO_      │                          │
  │   │    SENDER          │        │   CARRIER_HUB      │                          │
  │   └────────────────────┘        └────────────────────┘                          │
  │                                          │                                        │
  │   ┌────────────────────┐                 │                                        │
  │   │AWAITING_DROP_OFF_  │                 │                                        │
  │   │   AT_POINT         │                 │                                        │
  │   └────────────────────┘                 │                                        │
  │            │                              │                                        │
  │            ▼                              │                                        │
  │   ┌────────────────────┐                 │                                        │
  │   │DROPPED_OFF_AT_POINT│                 │                                        │
  │   └────────────────────┘                 │                                        │
  │            │                              │                                        │
  │            ▼                              │                                        │
  │   ┌────────────────────┐                 │                                        │
  │   │AWAITING_CARRIER_   │                 │                                        │
  │   │PICKUP_AT_POINT     │                 │                                        │
  │   └────────────────────┘                 │                                        │
  │            │                              │                                        │
  │            ▼                              ▼                                        │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │COLLECTED_FROM_POINT│───────→│RECEIVED_AT_ORIGIN_ │                          │
  │   └────────────────────┘        │      HUB           │                          │
  │                                  └────────────────────┘                          │
  └─────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                           FASE B - TRANSPORTE                                    │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │    IN_TRANSFER     │───────→│IN_TRANSIT_TO_      │                          │
  │   └────────────────────┘        │   DESTINATION      │                          │
  │                                  └────────────────────┘                          │
  │                                          │                                        │
  │                                          ▼                                        │
  │                                  ┌────────────────────┐                          │
  │                                  │AT_DESTINATION_HUB  │                          │
  │                                  └────────────────────┘                          │
  │                                          │                                        │
  │                         ┌────────────────┴────────────────┐                      │
  │                         ▼                                  ▼                      │
  │                ┌────────────────────┐        ┌────────────────────┐              │
  │                │  OUT_FOR_DELIVERY  │        │AWAITING_PICKUP_AT_ │              │
  │                └────────────────────┘        │  DESTINATION_HUB   │              │
  │                         │                     └────────────────────┘              │
  └─────────────────────────┴────────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                           FASE C - ENTREGA                                       │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │     DELIVERED      │        │DELIVERED_AT_       │    ← FINAL               │
  │   │     (FINAL)        │        │DESTINATION_HUB     │                          │
  │   └────────────────────┘        │    (FINAL)         │                          │
  │                                  └────────────────────┘                          │
  │                                                                                   │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │DELIVERY_ATTEMPT_   │───────→│  DELIVERY_PROBLEM  │                          │
  │   │    FAILED          │        └────────────────────┘                          │
  │   └────────────────────┘                 │                                        │
  │                                          ▼                                        │
  │                                  ┌────────────────────┐                          │
  │                                  │RETURNING_TO_SENDER │                          │
  │                                  └────────────────────┘                          │
  │                                          │                                        │
  │                                          ▼                                        │
  │                                  ┌────────────────────┐                          │
  │                                  │RETURNED_TO_SENDER  │    ← FINAL               │
  │                                  │      (FINAL)       │                          │
  │                                  └────────────────────┘                          │
  └─────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                    FASE D - CANCELAMENTO (pode partir de qualquer fase)          │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                   │
  │   DE CANCELLABLE_BEFORE_HANDOFF:                                                 │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │CANCELLATION_       │───────→│CANCELLED_BEFORE_   │    ← FINAL               │
  │   │REQUESTED_BEFORE_   │        │    HANDOFF         │                          │
  │   │    HANDOFF         │        │     (FINAL)        │                          │
  │   └────────────────────┘        └────────────────────┘                          │
  │                                                                                   │
  │   DE CANCELLABLE_IN_TRANSIT:                                                     │
  │   ┌────────────────────┐        ┌────────────────────┐                          │
  │   │CANCELLATION_       │───────→│CANCELLED_IN_       │                          │
  │   │REQUESTED_IN_       │        │TRANSIT_RETURNING   │                          │
  │   │    TRANSIT         │        └────────────────────┘                          │
  │   └────────────────────┘                 │                                        │
  │                                          ▼                                        │
  │                                  ┌────────────────────┐                          │
  │                                  │CANCELLED_IN_       │    ← FINAL               │
  │                                  │TRANSIT_RETURNED    │                          │
  │                                  │     (FINAL)        │                          │
  │                                  └────────────────────┘                          │
  │                                                                                   │
  │   EXPIRAÇÃO:                                                                      │
  │   ┌────────────────────┐                                                         │
  │   │ EXPIRED_NOT_POSTED │    ← FINAL                                              │
  │   │      (FINAL)       │                                                         │
  │   └────────────────────┘                                                         │
  └─────────────────────────────────────────────────────────────────────────────────┘

  2.2 Tabela de Transições com Validação

  | From Status                           | To Status                             | Quem pode | Validação        | Side-Effects          | Código                                         |
  |---------------------------------------|---------------------------------------|-----------|------------------|-----------------------|------------------------------------------------|
  | AWAITING_DROP_OFF_AT_POINT            | CANCELLATION_REQUESTED_BEFORE_HANDOFF | User      | canBeCancelled() | Cancela PickupRequest | app/api/shipments/[id]/cancel/route.ts:97      |
  | PICKUP_REQUESTED                      | CANCELLATION_REQUESTED_BEFORE_HANDOFF | User      | canBeCancelled() | Cancela PickupRequest | app/api/shipments/[id]/cancel/route.ts:97      |
  | CANCELLATION_REQUESTED_BEFORE_HANDOFF | CANCELLED_BEFORE_HANDOFF              | System    | Automático       | Deleta Label, Refund  | app/api/shipments/[id]/cancel/route.ts:248-288 |
  | IN_TRANSIT_*                          | DELIVERED                             | Webhook   | Nenhuma          | Atualiza deliveredAt  | app/api/webhooks/tracking/route.ts:97-103      |
  | ANY                                   | ANY                                   | Admin     | NENHUMA          | Nenhum                | app/api/admin/ops/shipments/[id]/route.ts:360  |

  2.3 CRÍTICO: isValidTransition() NÃO IMPLEMENTADA

  Arquivo: modules/shipments/application/status-migration.ts:158-167

  export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
    // TODO: Implementar validações mais específicas conforme necessário
    // Por enquanto, permite todas as transições
    return true;  // ← PERMITE QUALQUER TRANSIÇÃO
  }

  Impacto: Qualquer código que use esta função para validar transições aceita qualquer mudança de status.

  2.4 WalletTransaction State Machine

  | Status    | Transições Permitidas | Quem pode | Código               |
  |-----------|-----------------------|-----------|----------------------|
  | PENDING   | CONFIRMED, FAILED     | System    | Webhook de pagamento |
  | CONFIRMED | (terminal)            | -         | -                    |
  | FAILED    | (terminal)            | -         | -                    |

  2.5 Label Status

  | Status   | Significado                 | Transições                |
  |----------|-----------------------------|---------------------------|
  | pending  | Criada, não emitida         | → issued, canceled, error |
  | issued   | Emitida pela transportadora | → canceled                |
  | canceled | Cancelada                   | (terminal)                |
  | error    | Erro na emissão             | → pending (retry)         |

  ---
  ENTREGÁVEL 3 — MATRIZ OPERAÇÃO x ROLE x STATUS

  3.1 Operações de Usuário (User)

  | Operação          | Roles | Status Permitidos                                  | Checks Backend                        | Enforcement                                      | Bypass Possível         |
  |-------------------|-------|----------------------------------------------------|---------------------------------------|--------------------------------------------------|-------------------------|
  | Criar Shipment    | User  | N/A (novo)                                         | Quote válida, não expirada, ownership | checkout.service.ts:163-210                      | ❌                       |
  | Cancelar Shipment | User  | CANCELLABLE_BEFORE_HANDOFF, CANCELLABLE_IN_TRANSIT | canBeCancelled(), ownership           | app/api/shipments/[id]/cancel/route.ts:97        | ❌                       |
  | Baixar PDF        | User  | Qualquer                                           | Ownership, carrierPrePostageId existe | app/api/packages/[id]/pdf/route.ts:45-53         | ⚠️ Não valida pagamento |
  | Marcar Impresso   | User  | Qualquer                                           | Ownership                             | app/api/labels/[id]/route.ts:273                 | ⚠️ Pode reverter        |
  | Ver Etiquetas     | User  | Não cancelled/failed                               | Ownership via senderId                | modules/labels/application/list.service.ts:57-59 | ❌                       |

  3.2 Operações de Admin (StaffUser)

  | Operação        | Permission | Status Permitidos | Checks Backend              | Enforcement                                             | Bypass Possível              |
  |-----------------|------------|-------------------|-----------------------------|---------------------------------------------------------|------------------------------|
  | Ver Shipment    | OPERACOES  | Qualquer          | Session válida              | app/api/admin/ops/shipments/[id]/route.ts:206           | ❌                            |
  | Editar Shipment | OPERACOES  | Qualquer          | Session válida              | app/api/admin/ops/shipments/[id]/route.ts:338           | ⚠️ Pode mudar qualquer campo |
  | Mudar Status    | OPERACOES  | Qualquer          | NENHUM                      | app/api/admin/ops/shipments/[id]/route.ts:360           | ✅ Total bypass               |
  | Ajustar Wallet  | CONTAS     | N/A               | Session válida, user existe | app/api/admin/clients/[id]/wallet/adjust/route.ts:25-46 | ⚠️ Sem limite                |
  | Crédito Manual  | CONTAS     | N/A               | Session válida              | wallet.service.ts:469-543                               | ⚠️ Sem aprovação dupla       |
  | Débito Manual   | CONTAS     | N/A               | Saldo suficiente            | wallet.service.ts:559-640                               | ⚠️ Sem FOR UPDATE            |

  3.3 Operações de Webhook

  | Operação           | Autenticação   | Status Permitidos               | Checks Backend  | Enforcement                                | Bypass Possível    |
  |--------------------|----------------|---------------------------------|-----------------|--------------------------------------------|--------------------|
  | Atualizar Tracking | Nenhuma (TODO) | Não DELIVERED/CANCELED/RETURNED | Shipment existe | app/api/webhooks/tracking/route.ts:111-120 | ✅ Webhook sem auth |
  | Marcar DELIVERED   | Nenhuma        | Qualquer                        | Shipment existe | app/api/webhooks/tracking/route.ts:96-103  | ✅ Webhook sem auth |

  3.4 Operações de Pickup Point

  | Operação        | Roles       | Status Permitidos             | Checks Backend | Enforcement   |
  |-----------------|-------------|-------------------------------|----------------|---------------|
  | Receber Volume  | PickupPoint | Reception.status = PENDING    | Session válida | DB constraint |
  | Registrar Issue | PickupPoint | Reception.status != PROCESSED | Session válida | -             |

  3.5 Operações de Collector

  | Operação        | Roles     | Status Permitidos                | Checks Backend | Enforcement |
  |-----------------|-----------|----------------------------------|----------------|-------------|
  | Aceitar Coleta  | Collector | PickupRequest.status = PENDING   | Session válida | -           |
  | Marcar Coletado | Collector | PickupRequest.status = SCHEDULED | Session válida | -           |
  | Registrar Falha | Collector | PickupRequest.status = SCHEDULED | Session válida | -           |

  ---
  ENTREGÁVEL 4 — ACHADOS (TODOS)

  (A) Buracos de Transição de Estado

  | ID   | Descrição                                                             | Código-Fonte                                              | Impacto                                                 |
  Severidade |
  |------|-----------------------------------------------------------------------|-----------------------------------------------------------|---------------------------------------------------------|--------
  ----|
  | A-01 | isValidTransition() retorna true para todas transições                | modules/shipments/application/status-migration.ts:158-167 | Qualquer status pode ser setado sem validação de origem | 🔴
  CRÍTICO |
  | A-02 | Admin PATCH pode setar qualquer status sem validar máquina de estados | app/api/admin/ops/shipments/[id]/route.ts:360             | Admin pode colocar shipment em estado inconsistente     | 🔴
  CRÍTICO |
  | A-03 | Webhook tracking atualiza status sem usar isValidTransition()         | app/api/webhooks/tracking/route.ts:96-120                 | Transportadora pode forçar transições inválidas         | 🟠 ALTO
      |
  | A-04 | Status final não é verificado antes de permitir operações             | Múltiplos endpoints                                       | Operações podem ser feitas em shipments finalizados     | 🟠 ALTO
      |

  (B) Enforcement só no Frontend

  | ID   | Descrição                                    | Código-Fonte Frontend                    | Deveria Estar                                          | Severidade               |
  |------|----------------------------------------------|------------------------------------------|--------------------------------------------------------|--------------------------|
  | B-01 | Botão de cancelar desabilitado por status    | components/shipments/ShipmentActions.tsx | app/api/shipments/[id]/cancel/route.ts (OK, tem check) | ✅ OK (tem check backend) |
  | B-02 | Botão de imprimir só aparece se label existe | components/labels/LabelCard.tsx          | Backend não valida se PDF deveria estar disponível     | 🟡 MÉDIO                 |
  | B-03 | Validação de CEP                             | components/quote/QuoteForm.tsx           | Validado no backend                                    | ✅ OK                     |

  (C) Furos Financeiros

  | ID   | Descrição                                                        | Código-Fonte                                             | Impacto                                                            |
  Severidade |
  |------|------------------------------------------------------------------|----------------------------------------------------------|--------------------------------------------------------------------|---
  ---------|
  | C-01 | Wallet.availableCents sem CHECK constraint no DB                 | prisma/schema.prisma:437                                 | Race condition entre FOR UPDATE e UPDATE pode gerar saldo negativo | 🔴
   CRÍTICO |
  | C-02 | Admin pode ajustar wallet sem limite de valor                    | app/api/admin/clients/[id]/wallet/adjust/route.ts:47     | Fraude interna, sem controle de alçada                             | 🟠
   ALTO    |
  | C-03 | Admin débito manual não usa FOR UPDATE                           | app/api/admin/clients/[id]/wallet/adjust/route.ts:71-102 | Race condition pode gerar saldo negativo                           | 🟠
   ALTO    |
  | C-04 | Refund no cancelamento não valida se já foi feito                | app/api/shipments/[id]/cancel/route.ts:321-339           | Não há idempotência explícita por referenceId                      | 🟡
   MÉDIO   |
  | C-05 | Idempotência de checkout por janela de 5 minutos em vez de chave | modules/cart/application/checkout.service.ts:432-452     | Checkout duplicado fora da janela cria shipment duplicado          | 🟡
   MÉDIO   |

  (D) Imutabilidade Violada

  | ID   | Campo                      | Invariante              | Código que Viola                                 | Impacto                                   | Severidade |
  |------|----------------------------|-------------------------|--------------------------------------------------|-------------------------------------------|------------|
  | D-01 | Label.isPrinted            | Só pode ir false→true   | app/api/labels/[id]/route.ts:280-281             | Pode reverter impressão, quebra auditoria | 🟠 ALTO    |
  | D-02 | Label.printedAt            | Imutável após set       | app/api/labels/[id]/route.ts:281                 | Pode resetar para null                    | 🟠 ALTO    |
  | D-03 | Shipment.freightCost       | Imutável após pagamento | app/api/admin/ops/shipments/[id]/route.ts:369    | Admin pode alterar valor após cobrança    | 🟡 MÉDIO   |
  | D-04 | Quote.selection.totalCents | Imutável após seleção   | Não há endpoint, mas não tem trigger de proteção | Potencial futuro                          | 🟢 BAIXO   |

  (E) Permissões Role/Tenant

  | ID   | Descrição                                                             | Código-Fonte                                      | Impacto                                             | Severidade |
  |------|-----------------------------------------------------------------------|---------------------------------------------------|-----------------------------------------------------|------------|
  | E-01 | Webhook tracking não tem autenticação                                 | app/api/webhooks/tracking/route.ts:53             | Atacante pode atualizar status de qualquer shipment | 🔴 CRÍTICO |
  | E-02 | Admin com OPERACOES pode editar qualquer shipment de qualquer usuário | app/api/admin/ops/shipments/[id]/route.ts:330-396 | Sem segregação por região/equipe                    | 🟡 MÉDIO   |
  | E-03 | Manual credit não requer aprovação de segundo admin                   | wallet.service.ts:469-543                         | Fraude de operador único                            | 🟠 ALTO    |
  | E-04 | Não há log de auditoria para mudanças de status via Admin             | app/api/admin/ops/shipments/[id]/route.ts         | Impossível rastrear quem mudou                      | 🟠 ALTO    |

  (F) PDF/Etiqueta sem Validação de Pagamento

  | ID   | Descrição                                         | Código-Fonte                             | Impacto                                      | Severidade |
  |------|---------------------------------------------------|------------------------------------------|----------------------------------------------|------------|
  | F-01 | Endpoint de PDF não verifica se shipment foi pago | app/api/packages/[id]/pdf/route.ts:27-53 | Usuário pode gerar etiqueta sem pagar        | 🔴 CRÍTICO |
  | F-02 | Endpoint não verifica se shipment está cancelado  | app/api/packages/[id]/pdf/route.ts:27-53 | Etiqueta de envio cancelado pode ser baixada | 🟠 ALTO    |

  (G) Cancelamento e Refund

  | ID   | Descrição                                  | Código-Fonte                                   | Impacto                                                 | Severidade |
  |------|--------------------------------------------|------------------------------------------------|---------------------------------------------------------|------------|
  | G-01 | Refund não é atômico com cancelamento      | app/api/shipments/[id]/cancel/route.ts:311-347 | Se refund falhar, usuário fica sem dinheiro e sem envio | 🟠 ALTO    |
  | G-02 | Sem retry automático para refund que falha | app/api/shipments/[id]/cancel/route.ts:341-346 | Apenas loga erro, não agenda retry                      | 🟠 ALTO    |
  | G-03 | Cancelamento no Correios é best-effort     | app/api/shipments/[id]/cancel/route.ts:183-236 | Se falhar, pré-postagem continua válida no Correios     | 🟡 MÉDIO   |

  (H) Consistência de Dados

  | ID   | Descrição                                                                    | Código-Fonte                    | Impacto                          | Severidade |
  |------|------------------------------------------------------------------------------|---------------------------------|----------------------------------|------------|
  | H-01 | Shipment.carrierTrackingCode pode divergir de Package[0].carrierTrackingCode | Múltiplos updates independentes | Confusão no tracking             | 🟡 MÉDIO   |
  | H-02 | Label.trackingCode pode divergir de Shipment.platformTrackingCode            | Criados em momentos diferentes  | Inconsistência de dados          | 🟡 MÉDIO   |
  | H-03 | Quote.selection não tem FK para QuoteOption                                  | prisma/schema.prisma:647-660    | Pode referenciar option deletada | 🟢 BAIXO   |

  ---
  RESUMO EXECUTIVO

  Contagem por Severidade

  | Severidade | Quantidade | Exemplos                                                         |
  |------------|------------|------------------------------------------------------------------|
  | 🔴 CRÍTICO | 5          | A-01, A-02, C-01, E-01, F-01                                     |
  | 🟠 ALTO    | 11         | A-03, A-04, C-02, C-03, D-01, D-02, E-03, E-04, F-02, G-01, G-02 |
  | 🟡 MÉDIO   | 8          | B-02, C-04, C-05, D-03, E-02, G-03, H-01, H-02                   |
  | 🟢 BAIXO   | 2          | D-04, H-03                                                       |
  | TOTAL      | 26         |                                                                  |

  Top 5 Ações Imediatas

  1. Implementar isValidTransition() - Definir matriz de transições válidas e aplicar em todos os pontos de mudança de status
  2. Adicionar CHECK constraint - ALTER TABLE wallets ADD CONSTRAINT chk_available_cents CHECK (availableCents >= 0)
  3. Autenticar webhook - Implementar HMAC signature verification em /api/webhooks/tracking
  4. Validar pagamento no PDF - Adicionar check shipment.paymentMethod !== null em /api/packages/[id]/pdf
  5. Tornar isPrinted monotônico - Rejeitar isPrinted=false se label já foi impressa

● A auditoria de regras de negócio do Envio Legal v2 está completa. Produzi os 4 entregáveis solicitados:

  ENTREGÁVEL 1 - MAPA DO DOMÍNIO: 16 invariantes documentadas com localização no código e status de enforcement. Destaque para 4 invariantes críticas NÃO enforced.

  ENTREGÁVEL 2 - STATE MACHINES:
  - Diagrama completo do ShipmentStatus com 27 estados em 4 fases
  - Tabela de transições com roles, validações e side-effects
  - Descoberta crítica: isValidTransition() retorna true para todas transições (não implementada)

  ENTREGÁVEL 3 - MATRIZ OPERAÇÃO x ROLE x STATUS:
  - 5 operações de User
  - 6 operações de Admin
  - 2 operações de Webhook
  - Identificação de bypasses em cada operação

  ENTREGÁVEL 4 - ACHADOS: 26 achados totais organizados em 8 categorias:
  - (A) 4 buracos de transição de estado
  - (B) 3 checks de enforcement frontend/backend
  - (C) 5 furos financeiros
  - (D) 4 violações de imutabilidade
  - (E) 4 problemas de permissão role/tenant
  - (F) 2 problemas de PDF sem validação
  - (G) 3 problemas de cancelamento/refund
  - (H) 3 problemas de consistência de dados

  Severidade: 5 CRÍTICOS | 11 ALTOS | 8 MÉDIOS | 2 BAIXOS

  Os 5 achados mais críticos são:
  1. isValidTransition() não implementada - permite qualquer transição de status
  2. Webhook tracking sem autenticação - atacante pode alterar status
  3. PDF sem validação de pagamento - usuário pode baixar etiqueta sem pagar
  4. Wallet sem CHECK constraint - pode gerar saldo negativo
  5. Admin pode setar qualquer status sem validar máquina de estados

