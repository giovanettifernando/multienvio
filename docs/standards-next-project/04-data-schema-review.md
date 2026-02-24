# Data Inventory and Schema Review

## Scope and method
- Source of truth: prisma/schema.prisma (see full extracted inventory in docs/standards-next-project/schema-inventory.md).
- Usage scan: token-based search across app/, modules/, platform/, shared/, scripts/, tests/ for prisma.<model> and word-boundary field names.
- Limitations: word-boundary scan can under/over-count (false positives on common words, false negatives when fields are accessed via include/select or raw SQL).
- Evidence: prisma/schema.prisma:1-1120; docs/standards-next-project/schema-inventory.md:1-1400; docs/standards-next-project/schema-usage-index.md:1-200

## Models and enums inventory
- Complete list of models and enums is in docs/standards-next-project/schema-inventory.md.
- Evidence: docs/standards-next-project/schema-inventory.md:1-1400

## Models with zero Prisma client references (potentially unused)
- PaymentEndpoint, QuoteOption, QuoteVolume, RecipientPaymentPackage, SupportAttachment.
- Evidence: docs/standards-next-project/schema-usage-zero.md:3-8; docs/standards-next-project/schema-usage-index.md:5-68

## Fields with zero code references (word-boundary scan)
- Address.billingCards, CarrierCredential.tokenUrl, StaffAuditLog.actor, StaffUser.auditLogs, User.assistantChatSessions, User.carts, User.packagingTemplates, User.passwordResetTokens, User.paymentTransactions, User.receivedShipments, User.recipientPaymentRequests, User.securityEvents, User.sentShipments, User.trackingCodeReservations.
- Evidence: docs/standards-next-project/schema-usage-zero.md:10-25

## Enum and contract divergences (schema vs shared types)
### Shipment status
- Shared contracts use lowercase status values (criado, postado, etc).
- Domain enum uses UPPER_SNAKE with many more lifecycle states.
- Database stores status as String with default "PICKUP_REQUESTED".
- Evidence: shared/types/contracts.ts:14-21; modules/shipments/application/shipment-status.ts:9-119; prisma/schema.prisma:184-199

### User status
- Shared contracts define UserStatus as active/blocked.
- Database stores status as String with default "pending".
- Login checks for UserStatus.ACTIVE.
- Evidence: shared/types/contracts.ts:65-68; prisma/schema.prisma:9-19; app/api/auth/login/route.ts:74-80

### Pickup point status
- Shared contracts define PickupPointStatus as active/blocked.
- Database enum includes PENDING.
- Evidence: shared/types/contracts.ts:57-60; prisma/schema.prisma:1042-1046

### Support ticket status/priority
- Shared contracts use ABERTO/EM_ATENDIMENTO/RESOLVIDO/FECHADO and BAIXA/MEDIA/ALTA/CRITICA.
- Database enums use OPEN/IN_PROGRESS/RESOLVED/CLOSED and LOW/MEDIUM/HIGH/URGENT.
- Evidence: shared/types/contracts.ts:37-52; prisma/schema.prisma:1023-1035

### Collection/Pickup status
- Shared contracts define CollectionStatus as aberta/agendada/em_andamento/concluida/cancelada.
- PickupRequest.status in schema uses PENDING/SCHEDULED/COLLECTED/FAILED/CANCELED/COMPLETED (String comment).
- Evidence: shared/types/contracts.ts:26-32; prisma/schema.prisma:301-305

### Admin status casing
- AdminStatus type uses lowercase active/blocked in app types.
- StaffStatus enum in schema uses ACTIVE/BLOCKED.
- Evidence: modules/auth/application/types.ts:27-33; prisma/schema.prisma:991-994

## Potential cleanup candidates (recommendations)
- Remove or consolidate models with zero usage (PaymentEndpoint, QuoteOption, QuoteVolume, RecipientPaymentPackage, SupportAttachment) after confirming no runtime use outside scan scope.
- Consolidate status enums across Prisma, domain, and shared contracts to avoid mismatched values and mapping drift (ShipmentStatus, UserStatus, PickupPointStatus, SupportTicketStatus, SupportPriority, CollectionStatus).
- Evidence: docs/standards-next-project/schema-usage-zero.md:3-25; shared/types/contracts.ts:14-79; modules/shipments/application/shipment-status.ts:9-119; prisma/schema.prisma:9-19, 184-199, 301-305, 1023-1046
