📋 AUDITORIA DE REGRAS DE NEGÓCIO - ENVIO LEGAL v2

  ---
  PARTE 1: CATÁLOGO DE REGRAS

  1. ENTIDADES CENTRAIS E INVARIANTES

  | Entidade      | Invariante Esperada                                    | Arquivo de Enforcement              | Status           |
  |---------------|--------------------------------------------------------|-------------------------------------|------------------|
  | Shipment      | Só existe após checkout pago ou em processo            | checkout.service.ts                 | ✅ Existe         |
  | Shipment      | senderId é imutável após criação                       | Nenhum                              | ⚠️ INDEFINIDO    |
  | Shipment      | postedAt é imutável após set                           | admin/ops/shipments/[id]/route.ts   | ❌ NÃO ENFORCED   |
  | Shipment      | Status só pode transicionar por regras definidas       | status-migration.ts                 | ⚠️ PARCIAL       |
  | Label         | Só existe se shipment válido existe                    | checkout.service.ts:521             | ✅ Existe         |
  | Label         | isPrinted só pode ir de false→true (nunca reverter)    | labels/[id]/route.ts:281            | ❌ NÃO ENFORCED   |
  | Wallet        | availableCents >= 0 sempre                             | debit.service.ts:169-174            | ✅ App-level      |
  | Wallet        | availableCents >= 0 sempre                             | prisma/schema.prisma                | ❌ SEM CHECK DB   |
  | Wallet        | Soma de transações = saldo (ledger = fonte de verdade) | N/A                                 | ⚠️ DUPLA VERDADE |
  | Package       | Pertence a exatamente 1 shipment                       | FK constraint                       | ✅ DB enforced    |
  | Reception     | Transição PENDING→RECEIVED/ISSUE é unidirecional       | receptions/[id]/receive/route.ts:72 | ✅ Existe         |
  | TrackingEvent | occurredAt é imutável                                  | Nenhum                              | ⚠️ INDEFINIDO    |
  | Quote         | Expira após expiresAt                                  | checkout.service.ts:200-212         | ✅ Enforced       |

  ---
  2. STATE MACHINE DE SHIPMENT

  2.1 Tabela Completa de Transições

  | Estado Atual                  | Próximos Permitidos                                                                                    | Ação                                       | Validações
      | Eventos Gerados             |
  |-------------------------------|--------------------------------------------------------------------------------------------------------|--------------------------------------------|-----------------------
  ----|-----------------------------|
  | PICKUP_REQUESTED              | PICKUP_SCHEDULED, AWAITING_PICKUP_AT_ORIGIN, CANCELLATION_REQUESTED_BEFORE_HANDOFF                     | Agendamento, chegada coletor, cancelamento | Shipment pago
      | TrackingEvent               |
  | PICKUP_SCHEDULED              | AWAITING_PICKUP_AT_ORIGIN, PICKUP_FAILED, COLLECTED_FROM_SENDER, CANCELLATION_REQUESTED_BEFORE_HANDOFF | Coleta, falha, cancelamento                | Coletor autenticado
      | TrackingEvent               |
  | AWAITING_PICKUP_AT_ORIGIN     | PICKUP_FAILED, COLLECTED_FROM_SENDER, CANCELLATION_REQUESTED_BEFORE_HANDOFF                            | Coleta ou falha                            | Coletor autenticado
      | TrackingEvent               |
  | AWAITING_DROP_OFF_AT_POINT    | DROPPED_OFF_AT_POINT, CANCELLATION_REQUESTED_BEFORE_HANDOFF                                            | Entrega no ponto                           | Ponto ativo
      | Reception + TrackingEvent   |
  | DROPPED_OFF_AT_POINT          | AWAITING_CARRIER_PICKUP_AT_POINT, COLLECTED_FROM_POINT                                                 | Coleta pela transportadora                 | Reception confirmada
      | TrackingEvent               |
  | COLLECTED_FROM_SENDER         | IN_TRANSIT_TO_CARRIER_HUB, RECEIVED_AT_ORIGIN_HUB                                                      | Entrega ao CD                              | Coletor autenticado
      | TrackingEvent               |
  | IN_TRANSIT_TO_CARRIER_HUB     | RECEIVED_AT_ORIGIN_HUB, CANCELLATION_REQUESTED_IN_TRANSIT                                              | Chegada no CD                              | Webhook transportadora
      | TrackingEvent               |
  | RECEIVED_AT_ORIGIN_HUB        | IN_TRANSFER, IN_TRANSIT_TO_DESTINATION, CANCELLATION_REQUESTED_IN_TRANSIT                              | Postagem                                   | Webhook ou ponto
  confirma | TrackingEvent, set postedAt |
  | IN_TRANSIT_TO_DESTINATION     | AT_DESTINATION_HUB, OUT_FOR_DELIVERY, DELIVERED, CANCELLATION_REQUESTED_IN_TRANSIT                     | Webhook                                    | -
      | TrackingEvent               |
  | OUT_FOR_DELIVERY              | DELIVERED, DELIVERY_ATTEMPT_FAILED, DELIVERY_PROBLEM, CANCELLATION_REQUESTED_IN_TRANSIT                | Webhook                                    | -
      | TrackingEvent               |
  | DELIVERED                     | (FINAL)                                                                                                | -                                          | -
      | set deliveredAt             |
  | CANCELLED_BEFORE_HANDOFF      | (FINAL)                                                                                                | -                                          | -
      | Refund                      |
  | CANCELLED_IN_TRANSIT_RETURNED | (FINAL)                                                                                                | -                                          | -
      | -                           |
  | RETURNED_TO_SENDER            | (FINAL)                                                                                                | -                                          | -
      | -                           |

  2.2 Problemas Identificados na State Machine

  1. isValidTransition() não implementada - status-migration.ts:166: return true; permite qualquer transição
  2. Webhook de tracking pode forçar status inválido - webhooks/tracking/route.ts:97-119: Não valida transições permitidas
  3. Admin pode setar qualquer status - admin/ops/shipments/[id]/route.ts:360: updateData.status = validatedData.status; sem validação

  ---
  3. REGRAS POR OPERAÇÃO CRÍTICA

  3.1 Imprimir Etiqueta

  | Aspecto      | Regra Esperada                       | Implementação Real                                             | Status           |
  |--------------|--------------------------------------|----------------------------------------------------------------|------------------|
  | Pré-condição | Shipment deve estar pago             | labels/[id]/route.ts: Não verifica                             | ❌ FURO           |
  | Pré-condição | Shipment não pode estar cancelado    | labels/[id]/route.ts: Não verifica                             | ❌ FURO           |
  | Pré-condição | Label deve existir e ter PDF         | packages/[id]/pdf/route.ts:50-53: Verifica carrierPrePostageId | ✅ OK             |
  | Pós-condição | Marcar isPrinted=true, printedAt=now | labels/[id]/route.ts:277-282                                   | ⚠️ Parcial       |
  | Idempotência | Não impedir re-impressão             | Não há bloqueio                                                | ✅ OK (by design) |

  3.2 Marcar como Postado (postedAt)

  | Aspecto       | Regra Esperada                          | Implementação Real                              | Status         |
  |---------------|-----------------------------------------|-------------------------------------------------|----------------|
  | Pré-condição  | Shipment deve ter label emitida         | N/A                                             | ❌ NÃO ENFORCED |
  | Pré-condição  | Status deve permitir postagem           | webhooks/tracking/route.ts: Não valida          | ❌ FURO         |
  | Imutabilidade | postedAt não pode ser alterado após set | admin/ops/shipments/[id]/route.ts: Não bloqueia | ❌ FURO         |
  | Efeitos       | Criar TrackingEvent, notificar usuário  | webhooks/tracking/route.ts: Cria evento         | ✅ OK           |

  3.3 Alterar Destinatário

  | Aspecto      | Regra Esperada                      | Implementação Real        | Status         |
  |--------------|-------------------------------------|---------------------------|----------------|
  | Pré-condição | Só antes de postar                  | Admin pode alterar sempre | ❌ FURO CRÍTICO |
  | Quem pode    | Owner antes, Admin sempre com audit | Sem audit trail           | ❌ FURO         |
  | Efeitos      | Recalcular frete se CEP mudou       | Não recalcula             | ⚠️ INDEFINIDO  |

  3.4 Cancelar Shipment

  | Aspecto      | Regra Esperada                                                 | Implementação Real                     | Status        |
  |--------------|----------------------------------------------------------------|----------------------------------------|---------------|
  | Pré-condição | Status em CANCELLABLE_BEFORE_HANDOFF ou CANCELLABLE_IN_TRANSIT | shipments/[id]/cancel/route.ts:97-103  | ✅ Enforced    |
  | Reembolso    | Se pago com wallet e antes do handoff, reembolsar              | shipments/[id]/cancel/route.ts:311-347 | ⚠️ Parcial    |
  | Correios     | Cancelar pré-postagens                                         | shipments/[id]/cancel/route.ts:183-236 | ✅ Best-effort |
  | Idempotência | Chamar 2x não deve duplicar refund                             | refund() usa referenceId               | ⚠️ Verificar  |

  3.5 Débito de Wallet

  | Aspecto      | Regra Esperada                        | Implementação Real                           | Status     |
  |--------------|---------------------------------------|----------------------------------------------|------------|
  | Pré-condição | Saldo >= valor a debitar              | debit.service.ts:169-174: FOR UPDATE + check | ✅ Enforced |
  | Atomicidade  | Transação única                       | debit.service.ts:151-207: $transaction       | ✅ OK       |
  | Idempotência | referenceId único impede duplicata    | debit.service.ts:110-133 + unique constraint | ✅ Enforced |
  | Efeitos      | Criar WalletTransaction + LedgerEntry | debit.service.ts:180-244                     | ✅ OK       |

  3.6 Checkout/Pagamento

  | Aspecto      | Regra Esperada                                 | Implementação Real                                    | Status     |
  |--------------|------------------------------------------------|-------------------------------------------------------|------------|
  | Preço        | SEMPRE vem do servidor, nunca do cliente       | checkout.service.ts:148-242: validateQuoteAndGetPrice | ✅ ENFORCED |
  | Cotação      | Deve pertencer ao usuário e não estar expirada | checkout.service.ts:163-212                           | ✅ OK       |
  | Idempotência | Evitar shipment duplicado                      | checkout.service.ts:432-466: Últimos 5min             | ⚠️ Parcial |
  | Atomicidade  | Shipment + Label + PickupRequest em transação  | checkout.service.ts:430-557                           | ✅ OK       |

  ---
  PARTE 2: ACHADOS (FUROS DE REGRA DE NEGÓCIO)

  ---
  (A) FUROS DE TRANSIÇÃO DE STATUS

  A.1 [CRÍTICO] Webhook de Tracking Ignora State Machine

  Regra violada: Transições de status devem seguir a state machine definida

  Arquivo: app/api/webhooks/tracking/route.ts:84-120

  Evidência:
  // Linha 84-93: Cria evento sem validar transição
  const trackingEvent = await prisma.trackingEvent.create({
    data: {
      shipmentId,
      type: eventType,
      ...
    },
  });

  // Linha 96-103: Atualiza status sem validar se transição é permitida
  if (eventType === "DELIVERED") {
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: "DELIVERED",
        deliveredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
  }

  Como quebrar:
  1. Chamar POST /api/webhooks/tracking com payload:
  {
    "shipmentId": "<ID de shipment CANCELLED_BEFORE_HANDOFF>",
    "code": "DELIVERED",
    "description": "Entregue"
  }
  2. Shipment cancelado passa para DELIVERED

  Impacto: Shipment cancelado pode ser marcado como entregue, cliente não recebe reembolso correto, inconsistência de dados

  Correção:
  // Antes de criar evento/atualizar status:
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (FINAL_STATUSES.includes(shipment.status)) {
    throw ApiError.badRequest("Shipment em status final não pode receber eventos");
  }
  if (!isValidTransition(shipment.status, newStatus)) {
    throw ApiError.badRequest(`Transição ${shipment.status} → ${newStatus} não permitida`);
  }

  Teste necessário:
  - Integration test: Webhook para shipment CANCELLED deve retornar erro 400
  - Integration test: Webhook para shipment DELIVERED deve retornar erro 400

  ---
  A.2 [CRÍTICO] Admin Pode Setar Qualquer Status Sem Validação

  Regra violada: Mesmo admin deve respeitar transições válidas

  Arquivo: app/api/admin/ops/shipments/[id]/route.ts:359-360

  Evidência:
  // Status and carrier fields
  if (validatedData.status !== undefined) updateData.status = validatedData.status;
  // Nenhuma validação de transição permitida!

  Como quebrar:
  1. Admin autentica
  2. PATCH /api/admin/ops/shipments/{id} com {"status": "DELIVERED"} em shipment PICKUP_REQUESTED
  3. Shipment pula toda a jornada logística

  Impacto: Dados de operação inconsistentes, KPIs errados, rastreamento inválido, possível fraude

  Correção:
  if (validatedData.status !== undefined) {
    const currentShipment = await prisma.shipment.findUnique({ where: { id } });
    if (!isValidTransition(currentShipment.status, validatedData.status)) {
      throw new ApiError({
        code: 'invalid_transition',
        message: `Transição ${currentShipment.status} → ${validatedData.status} não permitida`,
        status: 400,
      });
    }
    updateData.status = validatedData.status;
  }

  Teste necessário:
  - Integration test: Admin não pode pular de PICKUP_REQUESTED para DELIVERED
  - E2E test: Fluxo admin deve seguir state machine

  ---
  A.3 [ALTO] isValidTransition() Não Implementada

  Regra violada: Deve haver validação formal de transições

  Arquivo: modules/shipments/application/status-migration.ts:158-167

  Evidência:
  export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
    // Transições sempre permitidas: para status de cancelamento
    if (Object.values(ShipmentStatus).includes(to) && to.includes('CANCELL')) {
      return canBeCancelled(from);
    }

    // TODO: Implementar validações mais específicas conforme necessário
    // Por enquanto, permite todas as transições
    return true;  // <-- FURO!
  }

  Impacto: Qualquer código que use isValidTransition pensando estar protegido não está

  Correção: Implementar matriz de transições completa:
  const TRANSITION_MATRIX: Record<ShipmentStatus, ShipmentStatus[]> = {
    [ShipmentStatus.PICKUP_REQUESTED]: [
      ShipmentStatus.PICKUP_SCHEDULED,
      ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
      ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
    ],
    // ... todas as outras
  };

  export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
    return TRANSITION_MATRIX[from]?.includes(to) ?? false;
  }

  Teste necessário:
  - Unit test: Cada transição válida deve retornar true
  - Unit test: Transições inválidas devem retornar false
  - 100% cobertura da matriz

  ---
  (B) FUROS POR ENFORCEMENT SÓ NO FRONTEND

  B.1 [CRÍTICO] Impressão de Etiqueta Sem Validar Status/Pagamento

  Regra violada: Só pode imprimir etiqueta de shipment pago e não cancelado

  Arquivo: app/api/packages/[id]/pdf/route.ts:27-53

  Evidência:
  // Busca package e verifica ownership
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      shipment: {
        select: {
          id: true,
          senderId: true,  // Só verifica ownership
          platformTrackingCode: true,
          // NÃO inclui: status, paymentMethod
        },
      },
    },
  });

  // Verifica permissão
  if (pkg.shipment.senderId !== session.userId) {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  // Verifica se tem pré-postagem (único check técnico)
  if (!pkg.carrierPrePostageId) {
    return NextResponse.json(
      { message: 'Pré-postagem não gerada para este volume' },
      { status: 400 }
    );
  }
  // Não verifica: status, paymentMethod, isPrinted, etc.

  Como quebrar:
  1. Usuário cria checkout mas não paga
  2. Pré-postagem pode já existir (criada no checkout)
  3. GET /api/packages/{id}/pdf → PDF baixado sem pagamento
  4. Usuário cancela checkout → Ficou com etiqueta grátis

  Impacto: Fraude - etiquetas sem pagamento, prejuízo financeiro

  Correção:
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      shipment: {
        select: {
          id: true,
          senderId: true,
          platformTrackingCode: true,
          status: true,
          paymentMethod: true,
        },
      },
    },
  });

  // Validar pagamento
  if (!pkg.shipment.paymentMethod) {
    return NextResponse.json({ message: 'Envio não pago' }, { status: 402 });
  }

  // Validar status não cancelado
  if (pkg.shipment.status.includes('CANCEL') || pkg.shipment.status.includes('EXPIRED')) {
    return NextResponse.json({ message: 'Envio cancelado ou expirado' }, { status: 400 });
  }

  Teste necessário:
  - Integration test: GET /api/packages/{id}/pdf com shipment não pago → 402
  - Integration test: GET /api/packages/{id}/pdf com shipment cancelado → 400

  ---
  B.2 [ALTO] Marcar Etiqueta Impressa Permite Reversão

  Regra violada: isPrinted deve ser monotônico (só pode ir de false→true)

  Arquivo: app/api/labels/[id]/route.ts:277-283

  Evidência:
  const { isPrinted } = parsed.data;

  const updated = await prisma.label.update({
    where: { id },
    data: {
      isPrinted: isPrinted ?? true,  // Aceita isPrinted=false!
      printedAt: isPrinted ? new Date() : null,  // Reseta printedAt se false!
    },
  });

  Como quebrar:
  1. PATCH /api/labels/{id} com {"isPrinted": true} → marca impressa
  2. PATCH /api/labels/{id} com {"isPrinted": false} → desmarca impressa, apaga printedAt
  3. Repete indefinidamente → histórico de impressão perdido

  Impacto: Perda de audit trail, impossível saber quantas vezes imprimiu, fraude de reimpressão

  Correção:
  // Só permitir marcar como impressa, nunca desmarcar
  if (isPrinted === false) {
    throw new ApiError({
      code: 'invalid_operation',
      message: 'Não é possível desmarcar etiqueta como não impressa',
      status: 400,
    });
  }

  // Se já impressa, não atualizar printedAt (manter original)
  if (label.isPrinted) {
    return { data: { message: 'Etiqueta já estava impressa', label: { ... } } };
  }

  Teste necessário:
  - Integration test: PATCH com isPrinted=false em label já impressa → 400
  - Unit test: printedAt nunca é sobrescrito após primeira impressão

  ---
  (C) FUROS FINANCEIROS

  C.1 [ALTO] Saldo Negativo Possível no DB (Falta CHECK Constraint)

  Regra violada: availableCents >= 0 deve ser invariante no banco

  Arquivo: prisma/schema.prisma (modelo Wallet)

  Evidência:
  model Wallet {
    id              String   @id @default(uuid())
    userId          String   @unique
    availableCents  Int      @default(0)  // Sem CHECK constraint
    pendingCents    Int      @default(0)
    ...
  }

  Como quebrar:
  1. Race condition entre FOR UPDATE e update (improvável mas possível em alta carga)
  2. Query direta no banco (admin, migração, script):
  UPDATE wallets SET "availableCents" = -1000 WHERE "userId" = 'xxx';
  3. Bug em novo código que não use debit.service.ts

  Impacto: Saldo negativo = dívida não registrada, inconsistência financeira

  Correção:
  ALTER TABLE wallets ADD CONSTRAINT positive_balance
    CHECK ("availableCents" >= 0 AND "pendingCents" >= 0);

  Teste necessário:
  - Database test: UPDATE para saldo negativo deve falhar
  - Integration test: Débito maior que saldo deve falhar antes de chegar no DB

  ---
  C.2 [MÉDIO] Refund Sem Verificar se Shipment Está Realmente Cancelado

  Regra violada: Refund só deve ocorrer para shipments em status de cancelamento

  Arquivo: app/api/shipments/[id]/cancel/route.ts:311-347

  Evidência:
  if (
    shipment.paymentMethod === 'WALLET' &&
    nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
  ) {
    // ... processa refund
  }

  O código verifica nextCancellationStatus, não o status final após a transação. Se a transação DB falhar mas o código continuar (bug hipotético), refund pode ocorrer sem cancelamento real.

  Impacto: Baixo - o fluxo atual parece correto, mas falta defesa em profundidade

  Correção: Após transação, re-verificar status antes de refund:
  const updatedShipment = await prisma.shipment.findUnique({ where: { id } });
  if (!updatedShipment.status.includes('CANCEL')) {
    logger.error({ ... }, 'Refund aborted - shipment not in cancelled state');
    return; // Não processar refund
  }

  Teste necessário:
  - Unit test com mock de transação falhando → refund não deve ocorrer

  ---
  C.3 [MÉDIO] Dupla Fonte de Verdade para Saldo (Wallet vs LedgerEntry)

  Regra violada: Deve haver uma única fonte de verdade para saldo

  Arquivos: modules/wallet/application/wallet.service.ts, debit.service.ts

  Evidência:
  - wallet.availableCents é atualizado diretamente
  - ledgerEntry é criado separadamente
  - Não há trigger/constraint garantindo SUM(ledger) = wallet.availableCents

  Como quebrar:
  1. Bug que cria LedgerEntry mas não atualiza Wallet (ou vice-versa)
  2. Migração que atualiza um e não outro
  3. Ao longo do tempo, valores divergem

  Impacto: Conciliação financeira impossível, auditoria comprometida

  Correção: Escolher uma abordagem:
  - Opção A: Wallet é calculado (availableCents = view de SUM de ledger)
  - Opção B: Trigger de DB que sincroniza wallet quando ledger muda
  - Opção C: Job periódico de conciliação com alerta

  Teste necessário:
  - Integration test: Após cada operação, verificar wallet.availableCents == SUM(ledger)
  - Monitoring: Alert se divergência > 0

  ---
  (D) FUROS POR CONCORRÊNCIA/RACE

  D.1 [ALTO] Idempotência de Checkout Baseada em Janela de Tempo

  Regra violada: Idempotência deve usar chave única, não janela temporal

  Arquivo: modules/cart/application/checkout.service.ts:432-452

  Evidência:
  const recentShipments = await tx.shipment.findMany({
    where: {
      senderId: input.userId,
      carrier: input.carrier,
      service: input.service,
      originCep: input.originCep,
      destinationCep: input.destinationCep,
      freightCost: serverFreightCost,
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
      },
    },
    // ...
  });

  Como quebrar:
  1. Usuário faz checkout às 10:00:00
  2. Usuário espera 6 minutos
  3. Usuário faz checkout idêntico às 10:06:01
  4. Dois shipments criados para mesma compra

  Impacto: Shipments duplicados, cobrança dupla

  Correção: Usar idempotency key explícita:
  // Cliente envia: X-Idempotency-Key: <UUID gerado no frontend>
  const idempotencyKey = req.headers.get('X-Idempotency-Key');
  if (idempotencyKey) {
    const existing = await tx.shipment.findFirst({
      where: { idempotencyKey },
    });
    if (existing) return existing;
  }
  // Criar shipment com idempotencyKey salvo

  Teste necessário:
  - Integration test: Checkout 2x com mesmo idempotency key → mesmo shipment
  - Integration test: Checkout 2x sem idempotency key após 6 min → 2 shipments (documentar comportamento)

  ---
  (E) FUROS DE CANCELAMENTO/ESTORNO/DISPUTA

  E.1 [ALTO] Admin Pode Alterar Destinatário de Shipment Já Postado

  Regra violada: Dados de endereço são imutáveis após postagem (etiqueta já impressa)

  Arquivo: app/api/admin/ops/shipments/[id]/route.ts:373-388

  Evidência:
  // Recipient fields - SEM verificar status
  if (validatedData.recipientName !== undefined) updateData.recipientName = validatedData.recipientName;
  if (validatedData.recipientPhone !== undefined) updateData.recipientPhone = validatedData.recipientPhone;
  if (validatedData.recipientEmail !== undefined) updateData.recipientEmail = validatedData.recipientEmail;
  if (validatedData.recipientDocument !== undefined)
    updateData.recipientDocument = validatedData.recipientDocument;

  // Destination address fields - SEM verificar status
  if (validatedData.destinationAddress !== undefined)
    updateData.destinationAddress = validatedData.destinationAddress;
  if (validatedData.destinationCity !== undefined) updateData.destinationCity = validatedData.destinationCity;
  if (validatedData.destinationCep !== undefined) updateData.destinationCep = validatedData.destinationCep;

  Como quebrar:
  1. Shipment está em IN_TRANSIT (etiqueta já na transportadora)
  2. Admin altera destinatário/CEP
  3. DB mostra CEP novo, etiqueta física mostra CEP antigo
  4. Pacote vai para lugar errado

  Impacto: Entrega no endereço errado, extravio, reclamação do cliente

  Correção:
  // Verificar se pode alterar endereço
  const EDITABLE_ADDRESS_STATUSES = [
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
    // NUNCA após postagem
  ];

  const shipment = await prisma.shipment.findUnique({ where: { id } });

  if (hasAddressChanges(validatedData) && !EDITABLE_ADDRESS_STATUSES.includes(shipment.status)) {
    throw new ApiError({
      code: 'cannot_edit',
      message: 'Não é possível alterar endereço após postagem',
      status: 400,
    });
  }

  Teste necessário:
  - Integration test: PATCH address em shipment IN_TRANSIT → 400
  - Integration test: PATCH address em shipment AWAITING_DROP_OFF_AT_POINT → 200

  ---
  E.2 [MÉDIO] Refund de Pagamento Mercado Pago Não Atualiza Wallet

  Regra violada: Refund externo deve se refletir na carteira do sistema

  Arquivo: app/api/payments/[id]/refund/route.ts:122-146

  Evidência:
  const refundResult = await refundPayment(externalId, amount);

  // Atualiza PaymentTransaction
  await prisma.paymentTransaction.update({
    where: { id },
    data: {
      status: newStatus,
      metadata: {
        // ...
        refundedCents: totalRefundedCents,
      },
    },
  });
  // NÃO atualiza Wallet!

  Se o pagamento original foi para recarga de wallet, o refund no MP deveria debitar a wallet.

  Impacto: Cliente recebe refund no cartão + mantém saldo na wallet = duplicação

  Correção:
  // Verificar se pagamento era TOPUP de wallet
  const paymentMeta = transaction.metadata as { purpose?: string };
  if (paymentMeta?.purpose === 'wallet_topup') {
    // Debitar wallet pelo valor reembolsado
    await debit(transaction.userId, refundedCents, 'Estorno de recarga', `refund:${refundResult.id}`);
  }

  Teste necessário:
  - Integration test: Refund de topup deve debitar wallet
  - Integration test: Refund de pagamento direto (não topup) NÃO deve debitar wallet

  ---
  (F) INCONSISTÊNCIAS DB vs UI

  F.1 [MÉDIO] mapToUIStatus Agrupa Status Diferentes

  Regra violada: UI deve distinguir estados que têm comportamentos diferentes

  Arquivo: modules/shipments/application/status-labels-map.ts:36-43

  Evidência:
  if (status === ShipmentStatus.PICKUP_FAILED) {
    return "Cancelado";  // PICKUP_FAILED != CANCELLED!
  }

  PICKUP_FAILED significa "coletor não conseguiu coletar" (pode tentar de novo), mas UI mostra "Cancelado" (terminal).

  Impacto: Usuário pensa que shipment está cancelado quando ainda pode ser reagendado

  Correção: Criar status UI intermediário ou manter distinção:
  if (status === ShipmentStatus.PICKUP_FAILED) {
    return "Falha na coleta"; // Novo status UI
  }

  Teste necessário:
  - E2E test: Shipment em PICKUP_FAILED deve mostrar opção "Reagendar", não "Cancelado"

  ---
  F.2 [BAIXO] Webhook Tracking Usa Status Strings Legadas

  Regra violada: Usar enum centralizado, não strings

  Arquivo: app/api/webhooks/tracking/route.ts:107-119

  Evidência:
  // Atualizar status apenas se não estiver em estado final
  const currentShipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { status: true },
  });
  if (currentShipment && !["DELIVERED", "CANCELED", "RETURNED"].includes(currentShipment.status)) {
    // "CANCELED" e "RETURNED" são strings legadas, não existem no enum novo

  Impacto: Status legados não são reconhecidos, webhook pode sobrescrever status final

  Correção:
  import { FINAL_STATUSES } from '@/modules/shipments/application/shipment-status';

  if (!FINAL_STATUSES.includes(currentShipment.status as ShipmentStatus)) {
    // ...
  }

  Teste necessário:
  - Unit test: FINAL_STATUSES inclui todos os status terminais do enum

  ---
  PARTE 3: RESUMO E PRIORIZAÇÃO

  | ID  | Severidade | Categoria            | Resumo                                    |
  |-----|------------|----------------------|-------------------------------------------|
  | A.1 | CRÍTICO    | Transição Status     | Webhook tracking ignora state machine     |
  | A.2 | CRÍTICO    | Transição Status     | Admin pode setar qualquer status          |
  | B.1 | CRÍTICO    | Enforcement Frontend | Impressão de PDF sem validar pagamento    |
  | A.3 | ALTO       | Transição Status     | isValidTransition() não implementada      |
  | B.2 | ALTO       | Enforcement Frontend | isPrinted pode ser revertido              |
  | C.1 | ALTO       | Financeiro           | Falta CHECK constraint no DB para saldo   |
  | D.1 | ALTO       | Concorrência         | Idempotência checkout por janela temporal |
  | E.1 | ALTO       | Cancelamento         | Admin altera endereço após postagem       |
  | C.2 | MÉDIO      | Financeiro           | Refund sem re-verificar status            |
  | C.3 | MÉDIO      | Financeiro           | Dupla fonte de verdade saldo              |
  | E.2 | MÉDIO      | Cancelamento         | Refund MP não atualiza wallet             |
  | F.1 | MÉDIO      | DB vs UI             | PICKUP_FAILED mostra como "Cancelado"     |
  | F.2 | BAIXO      | DB vs UI             | Webhook usa strings legadas               |

  ---
  DECISÕES DE NEGÓCIO NECESSÁRIAS (INDEFINIDAS)

  1. Shipment.senderId: Pode ser alterado? (transferência de envio entre contas)
  2. Alteração de destinatário: Até qual status é permitido?
  3. Re-impressão de etiqueta: Deve ter limite? Log de cada impressão?
  4. Refund de cancelamento in-transit: Valor integral ou proporcional ao trecho?
  5. Wallet negativa: Permitir para clientes premium ou sempre bloquear?

  ---

● Auditoria de regras de negócio concluída. Identifiquei 13 furos categorizados:

  Críticos (3):
  - Webhook de tracking ignora a state machine de status
  - Admin pode setar qualquer status sem validação
  - Impressão de PDF sem validar se shipment foi pago

  Altos (5):
  - isValidTransition() retorna true sempre (TODO não implementado)
  - isPrinted pode ser revertido para false
  - Falta CHECK constraint no banco para evitar saldo negativo
  - Idempotência de checkout baseada em janela de 5 minutos (não em chave)
  - Admin pode alterar endereço de shipment já postado

  Médios (4):
  - Refund sem re-verificar status pós-transação
  - Dupla fonte de verdade (Wallet vs LedgerEntry)
  - Refund no Mercado Pago não atualiza wallet
  - PICKUP_FAILED exibido como "Cancelado" na UI

  Baixos (1):
  - Webhook usa strings legadas ao invés do enum

  Os furos mais urgentes são os que permitem bypass de pagamento (B.1) e transições de status inválidas (A.1, A.2).

