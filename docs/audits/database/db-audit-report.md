## Relatório de Auditoria de Banco de Dados – Envio Legal

Este relatório foi produzido a partir de:
- `prisma/schema.prisma`
- Migrations em `prisma/migrations/**`
- Uso de Prisma Client, `$queryRaw` e rotas em `app/api/**`, `lib/**`, `scripts/**`, `tests-v2/**`

Nenhuma alteração foi aplicada em schema ou migrations; este documento é somente de análise e planejamento.

---

## 1. Inventário por Model/Tabela

> Nota: nomes de colunas seguem o schema Prisma; quando houver `@@map`/`@map`, o nome real em banco é indicado entre parênteses.

### 1.1 `Role` / tabela `roles`
- **PK**: `id` (`TEXT`, `uuid()`)
- **Colunas**:
  - `id` (NOT NULL, default `uuid()`)
  - `name` (NOT NULL, `@unique`)
  - `createdAt` (NOT NULL, default `now()`)
  - `updatedAt` (NOT NULL, `@updatedAt`)
- **Índices**:
  - `roles_name_key` (UNIQUE) – por `name`
- **Relacionamentos**:
  - `users` – 1:N com `User.roleId`

### 1.2 `User` / tabela `users`
- **PK**: `id` (`TEXT`, `uuid()`)
- **Colunas principais** (ativas hoje):
  - `id`, `name`, `email` (`@unique`), `passwordHash?`, `phone?`, `status` (default `"pending"`),
  - `roleId?` (FK → `roles.id`),
  - `lastLoginAt?`, `createdAt`, `updatedAt`,
  - `emailVerificationToken?` (`@unique`), `emailVerified` (default `false`), `emailVerifiedAt?`,
  - `termsAcceptedAt?`, `avatarUrl?`,
  - `googleId?` (`@unique`), `authProvider` (default `"email"`),
  - `cpf?`, `cnpj?`, `hasCompany` (default `false`), `razaoSocial?`,
  - `passwordUpdatedAt?`, `passwordHistory?` (`Json`),
  - `defaultPostingUnitId?` (sem FK explícita; campo “solto”).
- **Índices** (pós-migrations recentes):
  - `users_email_key` (UNIQUE)
  - `users_emailVerificationToken_key` (UNIQUE)
  - `users_googleId_key` (UNIQUE)
- **Relacionamentos**:
  - 1:N com `Address`, `Card`, `Cart`, `PasswordResetToken`, `PaymentTransaction`, `Quote`, `Recipient`, `Shipment` (sender/recipient), `SupportTicket`, `UserSecurityEvent`, `PackagingTemplate`, `RecurringItem`, `TrackingCodeReservation`, `RecipientPaymentRequest`, `AssistantChatSession`, `Wallet`.
- **Histórico relevante de migrations**:
  - `20251115200000_init`: adicionava `resetPasswordExpiry`, `resetPasswordToken`, `tokenVersion`.
  - `20251211000000_remove_user_token_version`: removeu `tokenVersion`.
  - Campos de reset de senha legados (`resetPasswordExpiry`, `resetPasswordToken`) ainda existem em banco, mas **não estão mais no schema Prisma** (eram gerenciados antes via app).

### 1.3 `Address` / tabela `addresses`
- **PK**: `id`
- **Colunas**:
  - `id`, `cep` (VARCHAR(8)), `logradouro`, `numero`, `complemento?`, `bairro`, `cidade`, `uf` (VARCHAR(2)),
  - `userId` (FK → `users.id`), `createdAt`, `updatedAt`,
  - `isDefault` (Boolean, default `false`),
  - `label?`.
- **Índices**:
  - `addresses_userId_idx` – por `userId`
  - `addresses_cep_idx` – por `cep`
- **Histórico**:
  - `20251115200000_init` criou campos: `cpfCnpj`, `name`, `referencia`, `role`.
  - `20251206000000_remove_unused_fields` removeu esses campos e o índice composto `addresses_userId_role_idx`.

### 1.4 `Card` / tabela `cards`
- **PK**: `id`
- **Colunas**:
  - `id`, `userId` (FK), `brand` (`CardBrand` enum), `holderName`, `last4`, `expMonth`, `expYear`,
  - `fingerprint`, `isDefault`, `billingAddressId?` (FK → `addresses.id`),
  - `vaultToken` (`@unique`), `panCipher?`, `createdAt`, `updatedAt`.
- **Índices**:
  - `cards_vaultToken_key` (UNIQUE)
  - `cards_userId_fingerprint_key` (UNIQUE composto)
  - `cards_userId_idx`, `cards_userId_isDefault_idx`.

### 1.5 `Recipient` / tabela `recipients`
- **PK**: `id`
- **Colunas**:
  - `id`, `userId` (FK), `name`, `nameSearch`,
  - `email?`, `document?`, `phone?`, `notes?`, `isDefault`,
  - Endereço completo (`cep`, `logradouro`, `numero`, `complemento?`, `bairro`, `cidade`, `uf`),
  - `createdAt`, `updatedAt`.
- **Índices**:
  - `userId,isDefault`
  - `userId,document`
  - `userId,name`
  - `userId,nameSearch`

### 1.6 `Cart` e `CartItem` / tabelas `carts`, `cart_items`
- **Cart**
  - PK: `id`
  - Colunas: `userId` (FK), `status` (OPEN/LOCKED etc.), `totals?` (Json), `meta?` (Json), `createdAt`, `updatedAt`.
  - Índices:
    - `carts_userId_status_idx`
    - Índices parciais:
      - `carts_user_open_unique` (UNIQUE, `userId` WHERE status='OPEN')
      - `carts_user_locked_unique` (UNIQUE, `userId` WHERE status='LOCKED')
- **CartItem**
  - PK: `id`
  - Colunas: `cartId` (FK), `originAddress` (Json), `destination` (Json), `volumes` (Json), `preferences` (Json),
    `insuranceValue?` (Decimal), `pickupPoint?` (Json), `pickupFee?` (Json), `selectedQuote` (Json), `totals` (Json),
    `document?` (Json), `createdAt`, `updatedAt`.
  - Índices:
    - `cart_items_cartId_idx`.

### 1.7 `Shipment`, `Label`, `Package`, `TrackingEvent`, `PickupRequest`, `Reception`
- **Shipment** (`shipments`)
  - PK: `id`
  - Colunas principais:
    - Identificação: `platformTrackingCode` (UNIQUE), `carrierTrackingCode?`, `publicTrackingId` (UNIQUE, default `cuid()`).
    - Dados de origem/destino: `senderId` (FK), `recipientId?` (FK), `recipientName?`, `recipientPhone?`, `recipientEmail?`, `recipientDocument?`, `destinationAddress?`, `destinationNeighborhood?`, `destinationCity`, `destinationState`, `originCep`, `destinationCep`.
    - Métricas: `weight`, `declaredValue`, `status` (default `PICKUP_REQUESTED`), `carrier?`, `service?`, `estimatedDays?`,
      `freightCost?`, `pickupFee?`, `pickupPointId?`, `document?` (Json), `paymentMethod?`.
    - Datas: `postedAt?`, `receivedAt?`, `receivedBy?`, `deliveredAt?`, `createdAt`, `updatedAt`.
    - Comissão: `platformShippingCommissionCents?`, `platformPickupCommissionCents?`.
  - Índices:
    - Simples: `platformTrackingCode`, `carrierTrackingCode`, `senderId`, `recipientId`, `status`, `publicTrackingId`, `createdAt`.
    - Compostos: `[senderId,status]`, `[senderId,status,createdAt]`.
- **Label** (`labels`)
  - PK: `id`
  - Colunas: `shipmentId` (FK, UNIQUE), `carrier`, `service`, `status` (default `"pending"`),
    `priceCents`, `currency` (default `"BRL"`), `trackingCode?`, `recipientName?`, `fileUrl?`, `fileBase64?` (Text),
    `contentType?`, `sizeBytes?`, `isPrinted`, `printedAt?`, `createdAt`, `updatedAt`.
  - Índices: `status`, `isPrinted`, `createdAt`, `status,isPrinted`, `trackingCode`.
- **Package** (`packages`)
  - PK: `id`
  - Colunas: `shipmentId` (FK), `packageNumber` (Int, UNIQUE por shipment), dimensões/peso, campos de divergência,
    `checkedAt?`, `checkedBy?`, `createdAt`, `updatedAt`.
  - Índices: `shipmentId`, `hasDivergence`, `checkedAt`, `carrierTrackingCode`.
- **TrackingEvent** (`tracking_events`)
  - PK: `id`
  - Colunas: `shipmentId` (FK), `type`, `description`, `city?`, `uf?`, `occurredAt`, `createdAt`.
  - Índices: `shipmentId,occurredAt`.
- **PickupRequest** (`pickup_requests`)
  - PK: `id`
  - Colunas: `companyId?`, `userId` (FK), `collectorId?` (FK), `shipmentId` (FK, UNIQUE),
    `originCep`, `originAddress?`, `originCity?`, `originUf?`,
    `windowStart?`, `windowEnd?`, `status` (default `PENDING`), `notes?`,
    `collectedAt?`, `collectedBy?`, `scannedCode?`,
    `deliveredToCarrierAt?`, `carrierRecipient?`, `carrierUnit?`,
    `scheduleAt?`, `attemptCount` (Int), `attemptNotes?` (Json),
    `createdAt`, `updatedAt`.
  - Índices: `status`, `createdAt`, `originCep`, `userId,status,createdAt`, `collectorId,status`, `collectorId,collectedAt`.
- **Reception** (`receptions`)
  - PK: `id`
  - Colunas: `pickupPointId` (FK), `trackingCode` (UNIQUE), `senderName`, `recipientName`, `weight?`, `declaredValue?`,
    `status` (enum), datas (`expectedAt?`, `receivedAt?`, `processedAt?`),
    `issueType?`, `issueDetails?`, `issuePhotos?` (Json),
    `commissionCents` (Int, default 0), `createdAt`, `updatedAt`.
  - Índices: `pickupPointId,status`, `pickupPointId,receivedAt`, `status`.

### 1.8 Tabelas de Staff/Admin/Segurança
- **StaffRole** (`staff_roles`), **StaffUser** (`staff_users`), **StaffAuditLog** (`staff_audit_logs`),
  **UserSecurityEvent** (`user_security_events`), **PasswordResetToken** (`password_reset_tokens`), **Wallet**, **WalletTransaction**
  - Estrutura segue o schema Prisma; todas têm PK simples (`id`), `createdAt`/`updatedAt` e índices bem alinhados com filtros de uso
    (`email`, `userId`, `status`, `createdAt` etc.).

### 1.9 Tabelas de Financeiro/Payment
- **PaymentGateway**, **PaymentCredential**, **PaymentEndpoint**, **PaymentTransaction**, **PaymentWebhook**, **LedgerEntry**:
  - Modelagem compatível com integração de gateways (slug único, métodos habilitados, credenciais por ambiente).
  - `LedgerEntry` hoje não tem FK forte para “conta” de domínio (apenas `accountType`/`accountId` livres).
  - Tabelas `payment_refunds` e `payment_chargebacks` existem apenas no histórico da migration inicial e foram **dropadas** em
    `20251206000000_remove_unused_fields` (não aparecem mais no schema).

### 1.10 Tabelas de Integração com Transportadoras
- **Carrier**, **CarrierService**, **CarrierEndpoint**, **CarrierCredential**, **CarrierPricingRule**, **CarrierWebhook**, **CarrierApiCall**
  - Estrutura aderente ao schema; destaque:
    - Campo `Carrier.shippingCommissionPercent` (DECIMAL(5,2)) foi adicionado em `20251215000000_add_carrier_shipping_commission`
      e populado a partir de `platform_commissions` para `slug='correios'`.
  - Campos grandes (`metadata`, `requestMapping`, `responseMapping`, `additionalFees`) como `JSONB` adequados para flexibilidade.

### 1.11 Tabelas de Configuração Geral
- **EmailConfig**, **GoogleOAuthConfig**, **PlatformCommission**, **OpenRouterConfig**, **KnowledgeBaseArticle**
  - Todas são tabelas “pequenas”, usadas via `findFirst`/`findMany` na área admin e nos serviços.

### 1.12 Tabelas de CEP/Correios/FIPE
- **CepLocation** (`cep_locations`) – cache de geocodificação.
- **CorreiosAgency** (`correios_agencies`) – cache de unidades dos Correios.
- **FipeVehicleBrand** / **FipeVehicleModel** – modelos da tabela FIPE.
  - Todas com índices coerentes com consultas por CEP/UF/cidade ou por `vehicleType`/`name`.

### 1.13 Tabelas de Despesas/FAQ/Wallet/RecipientPayment/Assistant
- **Expense**, **ExpenseTemplate**, **FAQItem**, **RecurringItem**, **TrackingCodeReservation**, **RecipientPaymentRequest**, **RecipientPaymentPackage**,
  **AssistantChatSession**, **AssistantChatMessage** – estritamente alinhadas ao schema, com índices em colunas de filtro (`status`, `userId`, datas).

---

## 2. Matriz de Uso por Campo

> Classificações:
> - **READ+WRITE**: lido e escrito em código de aplicação.
> - **WRITE_ONLY**: apenas escrito (create/update) e não lido para lógica/retorno.
> - **READ_ONLY**: lido, mas não escrito (campos derivados/legacy).
> - **FILTER_ONLY**: usado apenas em `where`/`orderBy`/`include` (para filtros e joins).
> - **UNUSED**: não aparecendo em código (nem Prisma nem SQL) – sujeito a “falso negativo”.
> - **SUSPECT**: possível uso indireto (relatórios, BI, acessos fora do repo).

Em vez de listar centenas de campos, abaixo estão as tabelas mais críticas com mapeamento por coluna e evidências;
para as demais, a regra geral é: se há referência em `lib/**/*.ts`, `app/api/**/*.ts` ou `scripts/**/*.ts`, o status é pelo menos `READ+WRITE` ou `FILTER_ONLY`.

### 2.1 `User`

| Coluna                         | Status       | Evidência principal                                                          | Observação de risco |
|--------------------------------|--------------|------------------------------------------------------------------------------|---------------------|
| `id`                           | READ+WRITE   | Criação em `auth/register`, uso em quase todos os `where: { id: ... }`      | Baixo               |
| `name`                         | READ+WRITE   | Formulários em `MinhaConta`, payloads de DTOs, atualização de perfil        | Baixo               |
| `email`                        | READ+WRITE   | Login (`auth/login`), cadastro, buscas admin (`admin/clients`)              | Baixo               |
| `passwordHash`                 | WRITE_ONLY   | Escrito em cadastro/troca de senha, raramente exposto em selects diretos    | Médio (segurança)   |
| `phone`                        | READ+WRITE   | Formulários de conta, contact info em UI                                    | Baixo               |
| `status`                       | FILTER_ONLY  | Filtros de clientes ativos/bloqueados (admin)                               | Médio               |
| `roleId` + relação `role`      | READ+WRITE   | Gestão de permissões/admin (`Staff` e `User` roles)                         | Médio               |
| `lastLoginAt`                  | WRITE_ONLY   | Atualizado em login, pouco usado em filtros                                 | Médio               |
| `emailVerificationToken`       | READ+WRITE   | Fluxo de verificação de email                                               | Médio               |
| `emailVerified`, `emailVerifiedAt` | READ+WRITE| Checagem de conta verificada, marcado em confirmação                         | Médio               |
| `termsAcceptedAt`              | WRITE_ONLY   | Registrado em cadastro, raramente utilizado em filtros                      | Médio               |
| `avatarUrl`                    | READ+WRITE   | Exibido no UI, atualizado em perfil                                         | Baixo               |
| `googleId`, `authProvider`     | READ+WRITE   | Login social (`auth/google/callback`), distinção de provedores              | Médio               |
| `cpf`, `cnpj`, `hasCompany`, `razaoSocial` | READ+WRITE | Dados de faturamento/empresa em formulários                                  | Médio               |
| `passwordUpdatedAt`, `passwordHistory` | WRITE_ONLY | Atualizado em rotinas de senha, potencialmente usado para segurança futura   | SUSPECT             |
| `defaultPostingUnitId`         | UNUSED/SUSPECT | Não aparece em código Prisma; não há FK; pode ter sido planejado para Correios | Alto (validar BI)   |

Resumo:
- A maioria dos campos de `User` é claramente **READ+WRITE**.
- `defaultPostingUnitId` é um **candidato forte a campo obsoleto** (sem uso no código).
- Campos de histórico de senha são **WRITE_ONLY** e podem ser relevantes para auditorias futuras → tratar como **SUSPECT** para remoção.

### 2.2 `Address`

| Coluna        | Status      | Evidência                                                        | Risco |
|---------------|-------------|------------------------------------------------------------------|-------|
| `cep`         | READ+WRITE  | Criação/edição de endereços, usados em cálculo de frete         | Baixo |
| `logradouro`  | READ+WRITE  | Formulários, exibição de endereços                             | Baixo |
| `numero`      | READ+WRITE  | Idem                                                             | Baixo |
| `complemento` | READ+WRITE  | Idem                                                             | Baixo |
| `bairro`      | READ+WRITE  | Idem                                                             | Baixo |
| `cidade`, `uf`| READ+WRITE  | Cálculos de frete, exibição                                     | Baixo |
| `userId`      | FILTER_ONLY | `where: { userId }` em listagens de endereços                  | Baixo |
| `isDefault`   | FILTER_ONLY | Seleção de endereço padrão                                      | Baixo |
| `label`       | READ+WRITE  | Campo de label no UI                                            | Baixo |

Campos antigos removidos (`cpfCnpj`, `name`, `referencia`, `role`) não aparecem mais no schema nem em código.

### 2.3 `Cart` e `CartItem`

| Tabela   | Coluna          | Status       | Evidência                                                | Risco |
|----------|-----------------|--------------|----------------------------------------------------------|-------|
| `Cart`   | `status`        | READ+WRITE   | Fluxo de checkout, locks (`OPEN`/`LOCKED`)              | Médio |
| `Cart`   | `totals`, `meta`| READ+WRITE   | Usados para armazenar snapshots de cálculo de frete     | Médio |
| `Cart`   | `createdAt`     | FILTER_ONLY  | Listagens ordenadas                                      | Baixo |
| `CartItem` | `originAddress`, `destination`, `volumes`, `preferences` | READ+WRITE | Preenchidos na UI de cotação                            | Médio |
| `CartItem` | `pickupPoint` | READ+WRITE   | Uso em coletas                                          | Médio |
| `CartItem` | `pickupFee`   | READ+WRITE   | Adicionado em `20251121000000_add_pickup_fee_to_cart_items`, usado em fluxo de checkout | Médio |
| `CartItem` | `selectedQuote`, `totals` | READ+WRITE | Snapshots de seleção e totais                           | Médio |
| `CartItem` | `document`    | READ+WRITE   | Documentos fiscais no fluxo de cotação                  | Médio |

Não há campos obviamente `UNUSED` aqui.

### 2.4 `Shipment` / `Package` / `Label`

- `Shipment`:
  - Campos de status e tracking (`status`, `platformTrackingCode`, `publicTrackingId`, `carrierTrackingCode`) são **READ+WRITE/FILTER_ONLY** em
    quase todas as APIs de tracking, admin de operações e webhooks.
  - Campos de endereço e destinatário são **READ+WRITE** (UI, relatórios).
  - `pickupFee`, `platformShippingCommissionCents`, `platformPickupCommissionCents` aparecem em APIs de financeiro/relatórios → **READ+WRITE**.
- `Package`:
  - Dimensões/peso: **READ+WRITE** (cálculo de divergência, relatórios).
  - Campos de divergência (`divergence*`, `hasDivergence`, `divergenceNotes`, `divergencePhotoUrl`) são usados em telas/admin → **READ+WRITE**.
  - `carrierTrackingCode` é usado para tracking por volume → **READ+WRITE/FILTER_ONLY**.
- `Label`:
  - `status`, `trackingCode`, `priceCents` e datas são usados em relatórios financeiros e filtros admin → **READ+WRITE/FILTER_ONLY**.

Nenhum campo crítico se mostra `UNUSED`; muitos são log/deriváveis mas usados em UI e relatórios.

### 2.5 Financeiro / Wallet / Expense / RecipientPayment

Em geral:
- Campos como `amountCents`, `status`, `createdAt`, `paidAt`, `dueDate`, `category`, `type`, `isRecurring` aparecem em:
  - `app/api/admin/finance/**`
  - `app/api/wallet/**`
  - `lib/wallet/**`, `lib/quotes/commission.ts`, `lib/recipient-payment/**`
- Classificação:
  - **READ+WRITE**: valores monetários e status.
  - **FILTER_ONLY**: índices como `[status, confirmedAt]`, `[type, createdAt]`.
  - **WRITE_ONLY**: alguns campos de auditoria (`createdBy`, `receiptUploadedAt`) usados mais para histórico, pouco usados em filtros.
  - Não há evidência de colunas totalmente `UNUSED` nessas tabelas.

### 2.6 Integrações / Configurações / Logs

- Tabelas de configuração (`EmailConfig`, `GoogleOAuthConfig`, `OpenRouterConfig`, `PlatformCommission`) são usadas com `findFirst`/`update/create` no admin:
  - Campos de credenciais são **WRITE_ONLY** em nível de negócios (não retornados para cliente), mas **READ+WRITE** no backend.
- Tabelas de logs (`StaffAuditLog`, `CarrierApiCall`, `PaymentWebhook`, `AssistantChatMessage`) têm muitos campos que são:
  - Gravados na criação do log e raramente lidos individualmente (tipicamente exibidos em grids/relatórios).
  - Classificação predominante: **WRITE_ONLY** ou **READ+WRITE** de baixa criticidade.

---

## 3. Candidatos a Remoção

### 3.1 Campos claramente não usados (UNUSED)

> Atenção: este bloco considera **apenas o que aparece no código do repositório via `rg`/Prisma**.
> Campos podem estar sendo utilizados por:
> - Queries manuais em ferramentas de BI;
> - Integradores externos;
> - Scripts fora deste repo.

- **User.defaultPostingUnitId**
  - **Evidência**: não há nenhuma ocorrência em código TypeScript (`rg "defaultPostingUnitId" -t ts`).
  - **Classificação**: `UNUSED` no app, `SUSPECT` em BI/export.
  - **Risco**: Médio/Alto – precisa de validação em produção (consultar dashboards/BI).

### 3.2 Campos potencialmente subutilizados (WRITE_ONLY / READ_ONLY)

- **User.passwordHistory**, **User.passwordUpdatedAt**
  - Gravados em fluxos de senha (segurança) ou planejados, mas pouco utilizados em filtros.
  - **Status**: `WRITE_ONLY` com finalidade de segurança.
  - **Recomendação**: **não remover agora** – podem ser necessários para auditoria de segurança e detecção de abuso.

- Campos de auditoria em tabelas como `Expense`, `ExpenseTemplate`, `FAQItem` (`createdBy`) e `*Config`:
  - Armazenam `createdBy`/`updatedById` e raramente são usados em consultas atuais.
  - **Status**: `WRITE_ONLY`.
  - **Recomendação**: manter; baixo custo em armazenamento, útil para rastreabilidade futura.

### 3.3 Agrupamento por risco

- **Removíveis com baixo risco**
  - Nenhum campo com evidência forte o suficiente para ser considerado “baixo risco” sem checagem extra.

- **Remoção com risco médio (exige validação)**
  - `User.defaultPostingUnitId` – forte candidato; exigir:
    - Query de produção para verificar se há valores não-nulos.
    - Checar dashboards/relatórios e scripts externos.

- **Não remover agora (suspeito)**
  - `User.passwordHistory`, `User.passwordUpdatedAt`.
  - Campos de `createdBy`/`updatedById` em tabelas de domínio e financeiro.

---

## 4. Redundâncias e Inconsistências

- **Status / enums textual vs. numericamente equivalentes**
  - `Shipment.status` é `TEXT` com convenção `UPPER_SNAKE_CASE` (Documentado em migrations).
  - Não há `statusText` duplicado, mas:
    - Algumas tabelas usam enums (`QuoteStatus`, `ReceptionStatus`, `SupportTicketStatus`).
    - Outras usam `String` “livre” (`Shipment.status`, `CarrierWebhook.status`, `PaymentWebhook.status`).
  - **Risco**: divergência semântica entre domínios; difícil quebrar agora, mas ponto de atenção para padronização futura.

- **Dados deriváveis**
  - `Shipment.declaredValue` vs. soma de valores em `document`/volumes – poderia ser derivado, mas é armazenado para performance.
  - `Expense.amountCents` vs. possíveis campos de cálculo de impostos – nada claramente redundante.

- **Nomes inconsistentes**
  - Uso misto de português/inglês (`razaoSocial`, `createdAt`, `pickupFee`, `payoutDay`).
  - Mistura `snake_case` via `@map` e `camelCase` no Prisma.
  - **Recomendação**: somente padronizar em futuras alterações de schema mantendo `@map` para não quebrar DB.

- **Null vs. default**
  - Em geral bem tratado (enums com default, datas opcionais nulas).
  - Alguns campos monetários e percentuais permitem `NULL` (`shippingCommissionPercent`, `pickupFeeCommissionPercent`),
    o que exige cuidado em agregações (necessário `COALESCE` em queries manuais).

- **Campos muito grandes (text/json)**
  - `Label.fileBase64` como `Text` pode ser pesado; no entanto, o sistema já oferece `fileUrl`.
  - `CarrierApiCall` e `PaymentWebhook` usam `JSONB` para payloads; adequado para logs mas pode crescer rapidamente.
  - **Sugestão**: considerar políticas de retenção/arquivo para logs antigos (não é quebra de schema).

- **Datas e timezone**
  - Todas as datas são `TIMESTAMP(3)` sem `TZ` no Postgres; a aplicação provavelmente assume UTC.
  - `createdAt`/`updatedAt` são consistentes em todos os models Prisma.

---

## 5. Performance e Otimizações

### 5.1 Consultas potencialmente pesadas (N+1, includes, selects amplos)

Com base em buscas em:
- `lib/assistant/tools/executors.ts`
- `lib/quotes/service.ts`
- `lib/shipments/create-paid-shipment.service.ts`
- `app/api/admin/finance/**`
- `app/api/admin/ops/shipments/**`

Foram identificados padrões:
- Uso frequente de `findMany` sobre:
  - `Shipment` com filtros por `status`, `senderId`, `createdAt`.
  - `WalletTransaction` com filtros por `walletId`, `status`, `createdAt`.
  - `Expense` filtrando por `status`, `category`, `createdAt`.
- Muitas queries utilizam índices já existentes (`@@index` compostos), o que é positivo.

Possíveis pontos de atenção:
- Listagens admin que fazem `include` com relações profundas (ex.: shipments + labels + packages + trackingEvents) podem
  resultar em payloads grandes, mas isso é mais questão de UI/DTO do que de schema.

### 5.2 Índices faltantes (sugestões)

Com base nos padrões de uso observados (e inferindo a partir de nomes de APIs):

- **Shipment**
  - Já possui índices adequados: `status`, `senderId,status`, `senderId,status,createdAt`, `createdAt`, `platformTrackingCode`.
  - **Sugestão**: avaliar se existe uso frequente de filtros por `destinationCep` ou `originCep` (rastreamento por CEP).
    - Se sim, considerar índices em `destinationCep` e/ou `originCep`.

- **RecipientPaymentRequest**
  - Já possui índices em `senderId`, `status`, `paymentToken`, `expiresAt`.
  - Sem recomendações adicionais com base nas rotas atuais.

- **Expense**
  - Índices existentes: `[type,status,createdAt]`, `[category,createdAt]`, `[dueDate]`, `[createdBy]`, `[dreAccountCode,createdAt]`.
  - Bem alinhado com página de DRE e relatórios.

### 5.3 Índices possivelmente excessivos

Não há evidência clara de índices redundantes críticos, principalmente porque muitos já foram limados nas migrations recentes (`schema.prisma` contém comentários de remoção de índices redundantes).

### 5.4 Constraints faltantes / tipos

- **FKs implícitas não modeladas**
  - `LedgerEntry.accountType`/`accountId`: sem FK; é um design deliberado para apontar para contas lógicas diversas.
  - `User.defaultPostingUnitId`: não possui FK; reforça hipótese de campo obsoleto.

- **Tipos**
  - Valores monetários (em centavos) usam `Int`, evitando problemas de `DECIMAL` – adequado.
  - Pesos e dimensões usam `Float` em alguns lugares (Shipment/Package) e `Decimal` em outros (QuoteVolume). Isso gera leve
    inconsistência, mas não crítica.

---

## 6. Conclusões e Recomendações de Alto Nível

- **Schema está majoritariamente saudável**, com bons índices em colunas de filtro mais usadas.
- **Campos candidatos a limpeza imediata** são raros; o principal destaque é `User.defaultPostingUnitId`.
- Há **campos WRITE_ONLY** (audit/security) que não devem ser removidos sem análise de segurança/jurídica.
- Melhorias futuras:
  - Padronizar enums/string statuses entre domínios (envios, webhooks, webhooks de pagamento).
  - Implementar política de retenção de logs grandes (`CarrierApiCall`, `PaymentWebhook`, `AssistantChatMessage`) via scripts
    ou tabelas de arquivamento, sem alterar schema principal.

Os próximos documentos (`db-audit-evidence.md` e `../../operations/migrations/db-audit-migration-plan.md`) detalham:
- Comandos de verificação automática de uso.
- Plano de migrações em fases (preparação, deprecação, remoção) com risco, validação e rollback.

