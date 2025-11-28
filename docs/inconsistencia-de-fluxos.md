# Inconsistências de Fluxo – Envio Legal
- Data: 2025-11-28
- Base: main @ b60e77b
- Fonte: análise estática do código (sem execução)

## 1) Resumo
- Total de inconsistências encontradas: 3
- Cobertura: comparação dirigida de fluxos de checkout/pagamento/carrinho e criação/atualização de envio (≈20 endpoints/rotas relacionadas, incluindo variantes desativadas e auxiliares). Método: leitura dos handlers API e serviços compartilhados e confronto de passos equivalentes para o mesmo conceito (criação de shipment, pagamento, estado do carrinho).

## 2) Lista de inconsistências (catálogo)

### IF-01 – Checkout persistente vs checkout in-memory
- **Conceito/ação:** criação de envios a partir do carrinho/checkout.
- **Fluxos/Entradas comparadas:**
  - A) POST `/api/checkout` (Fluxo F09)
  - B) POST `/api/carrinho/checkout` (alias `/api/cart/checkout`)
- **Evidência A (código):** `app/api/checkout/route.ts:95-499` > POST handler (Prisma + transação)
- **Evidência B (código):** `app/api/carrinho/checkout/route.ts:33-84` > POST handler (store global in-memory)
- **Diferença observada (A vs B):**
  - A: exige sessão, valida documentos/volumes, cria Shipment/Package/Label/TrackingEvent (Prisma), define status inicial logístico e PickupRequest opcional; considera idempotência; retorna tracking/pagamento.
  - B: não usa autenticação nem banco; cria “shipments” em arrays globais com status hardcoded `aguardando_coleta`, limpa carrinho in-memory e devolve IDs fictícios.
- **Efeito prático possível:** caminhos distintos geram registros incompatíveis (persistidos vs temporários), com status inicial, tracking e etiqueta não alinhados entre si.
- **Perguntas para validação (PO/BA):**
  - Q1: Qual caminho deve ser usado para criação real de envios?
  - Q2: Em quais ambientes/perfis o checkout in-memory deveria (ou não) estar disponível?

### IF-02 – Registro de pagamento via débito de carteira vs PATCH de pagamento do shipment
- **Conceito/ação:** confirmação e registro de pagamento do envio.
- **Fluxos/Entradas comparadas:**
  - A) POST `/api/wallet/debit` (Fluxo F10)
  - B) PATCH `/api/shipments/[id]/payment`
- **Evidência A (código):** `app/api/wallet/debit/route.ts:12-275` > POST handler
- **Evidência B (código):** `app/api/shipments/[id]/payment/route.ts:9-143` > PATCH handler
- **Diferença observada (A vs B):**
  - A: valida saldo e idempotência, debita carteira, cria WalletTransaction+LedgerEntry, atualiza Shipment document payment e coloca Label como `issued` com PDF mock; não altera Cart status.
  - B: apenas grava `paymentMethod` e, se status=failed, seta Shipment para `CANCELLED_BEFORE_HANDOFF`; se status=approved, pode marcar WalletTransaction confirmada, mas não emite Label nem atualiza document payment; adicionalmente marca Cart como `CHECKED_OUT` quando todos os shipments do cart LOCKED estão pagos.
- **Efeito prático possível:** pagamentos pelo PATCH não emitem etiqueta nem registram ledger, enquanto o débito de carteira emite; já o PATCH altera estado do carrinho para CHECKED_OUT, o débito não.
- **Perguntas para validação (PO/BA):**
  - Q1: O fluxo de pagamento deve emitir etiqueta/atualizar document payment sempre (como A) ou manter separação (como B)?
  - Q2: O estado do carrinho deve ser ajustado em todos os pagamentos ou apenas em cenários específicos?

### IF-03 – Estados do carrinho pós-checkout/pagamento
- **Conceito/ação:** estado final do carrinho após checkout/pagamento.
- **Fluxos/Entradas comparadas:**
  - A) DELETE `/api/carrinho` (limpeza padrão)
  - B) PATCH `/api/shipments/[id]/payment` (ajuste para CHECKED_OUT)
  - C) POST `/api/carrinho/checkout` (in-memory, limpa itens sem status de DB)
- **Evidência A (código):** `app/api/carrinho/route.ts:86-124` > DELETE handler
- **Evidência B (código):** `app/api/shipments/[id]/payment/route.ts:86-126` > trecho que seta `Cart.status='CHECKED_OUT'`
- **Evidência C (código):** `app/api/carrinho/checkout/route.ts:33-84` > POST handler
- **Diferença observada (A vs B vs C):**
  - A: após limpeza, carrinho volta para `OPEN`, totals zerados, meta limpa.
  - B: quando pagamento aprovado para shipments listados no meta do cart LOCKED, cart vira `CHECKED_OUT` e itens são deletados.
  - C: checkout in-memory limpa itens e totais do store global, sem status de carrinho em banco nem vínculo a LOCKED/CHECKED_OUT.
- **Efeito prático possível:** o mesmo conceito de “carrinho finalizado” resulta em statuses diferentes (OPEN vs CHECKED_OUT vs sem persistência), afetando reuso do carrinho ou visibilidade pós-pagamento.
- **Perguntas para validação (PO/BA):**
  - Q1: Qual status deve representar um carrinho concluído (OPEN resetado ou CHECKED_OUT)?
  - Q2: O carrinho deve ser reaproveitado após pagamento ou permanecer marcado como concluído?

## 3) Itens verificados e sem divergência relevante
- Cancelamento de envio: apenas o fluxo `/api/shipments/[id]/cancel` com regras consistentes de status/label/pickup.
- Consulta de envios: listagem e detalhe usam os mesmos filtros de ownership e exigência de packages.
- Criação de Shipment via checkout: além da rota in-memory já listada na inconsistência, não foram encontrados outros criadores persistentes paralelos.
- Validação de volumes no serviço compartilhado (`createShipmentWithVolumes`) é usada de forma uniforme no checkout principal.

## 4) Limitações
- Não foi possível confirmar uso efetivo dos endpoints in-memory em produção (podem ser restos de mock); análise estática considerou apenas o código presente.
- Integrações externas (Mercado Pago, Correios) não foram exercitadas; apenas comparada a lógica local dos handlers.
