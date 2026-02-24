# API Route Inventory (app/api)

## Routes grouped by top-level domain
### account
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/account/addresses | app/api/account/addresses/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/account/addresses/[id] | app/api/account/addresses/[id]/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/account/cards | app/api/account/cards/route.ts | withApiHandler | no | none | no | no |
| /api/account/cards/[id] | app/api/account/cards/[id]/route.ts | withApiHandler | no | none | no | no |
| /api/account/cards/[id]/create-token-backend | app/api/account/cards/[id]/create-token-backend/route.ts | withApiHandler | yes | none | no | no |
| /api/account/cards/[id]/make-default | app/api/account/cards/[id]/make-default/route.ts | withApiHandler | no | none | no | no |
| /api/account/cards/[id]/tokenize | app/api/account/cards/[id]/tokenize/route.ts | withApiHandler | no | none | no | no |
| /api/account/company | app/api/account/company/route.ts | withApiHandler | yes | none | no | no |
| /api/account/me | app/api/account/me/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/account/profile | app/api/account/profile/route.ts | withApiHandler | yes | none | no | no |
| /api/account/recipients | app/api/account/recipients/route.ts | withApiHandler | no | none | no | no |
| /api/account/recipients/[id] | app/api/account/recipients/[id]/route.ts | withApiHandler | no | none | no | no |
| /api/account/recipients/[id]/make-default | app/api/account/recipients/[id]/make-default/route.ts | withApiHandler | no | none | no | no |
| /api/account/recipients/import | app/api/account/recipients/import/route.ts | withApiHandler | no | none | no | no |
| /api/account/security/change-password | app/api/account/security/change-password/route.ts | withApiHandlerResponse, withApiHandler | yes | requireUserSession | yes | no |

### admin
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/admin/auth/heartbeat | app/api/admin/auth/heartbeat/route.ts | none | no | none | no | no |
| /api/admin/auth/login | app/api/admin/auth/login/route.ts | withApiHandlerResponse, withApiHandler | yes | none | yes | no |
| /api/admin/auth/logout | app/api/admin/auth/logout/route.ts | withApiHandlerResponse, withApiHandler | no | requireAdminSession, getAdminSessionFromRequest | no | no |
| /api/admin/auth/me | app/api/admin/auth/me/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/auth/refresh | app/api/admin/auth/refresh/route.ts | none | no | none | no | no |
| /api/admin/ceps/force-regeocode | app/api/admin/ceps/force-regeocode/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/ceps/list-low-precision | app/api/admin/ceps/list-low-precision/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ceps/list-manual-overrides | app/api/admin/ceps/list-manual-overrides/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ceps/manual-update | app/api/admin/ceps/manual-update/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/clients | app/api/admin/clients/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id] | app/api/admin/clients/[id]/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id]/addresses | app/api/admin/clients/[id]/addresses/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/[id]/addresses/[addressId] | app/api/admin/clients/[id]/addresses/[addressId]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/[id]/cards | app/api/admin/clients/[id]/cards/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id]/cards/[cardId] | app/api/admin/clients/[id]/cards/[cardId]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/[id]/details | app/api/admin/clients/[id]/details/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id]/profile | app/api/admin/clients/[id]/profile/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/[id]/recipients | app/api/admin/clients/[id]/recipients/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id]/recipients/[recipientId] | app/api/admin/clients/[id]/recipients/[recipientId]/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id]/recurring-items | app/api/admin/clients/[id]/recurring-items/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/[id]/recurring-items/[itemId] | app/api/admin/clients/[id]/recurring-items/[itemId]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/[id]/wallet | app/api/admin/clients/[id]/wallet/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/clients/[id]/wallet/adjust | app/api/admin/clients/[id]/wallet/adjust/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/block | app/api/admin/clients/block/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/clients/reset-password | app/api/admin/clients/reset-password/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/clients/unblock | app/api/admin/clients/unblock/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/coletores | app/api/admin/coletores/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/coletores/[id] | app/api/admin/coletores/[id]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/coletores/[id]/pickups | app/api/admin/coletores/[id]/pickups/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/coletores/[id]/reset-password | app/api/admin/coletores/[id]/reset-password/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/coletores/[id]/status | app/api/admin/coletores/[id]/status/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/comissoes | app/api/admin/config/comissoes/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/faq | app/api/admin/config/faq/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/faq/[id] | app/api/admin/config/faq/[id]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/google-oauth | app/api/admin/config/google-oauth/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/google-oauth/test | app/api/admin/config/google-oauth/test/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/openrouter | app/api/admin/config/openrouter/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/openrouter/models | app/api/admin/config/openrouter/models/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/config/openrouter/playground | app/api/admin/config/openrouter/playground/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/config/openrouter/test | app/api/admin/config/openrouter/test/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/correios-agencies | app/api/admin/correios-agencies/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/correios-agencies/sync | app/api/admin/correios-agencies/sync/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/dashboard | app/api/admin/dashboard/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/email-config | app/api/admin/email-config/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/email-config/send-test | app/api/admin/email-config/send-test/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/email-config/test-connection | app/api/admin/email-config/test-connection/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/finance/carrier-payouts | app/api/admin/finance/carrier-payouts/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/chargebacks | app/api/admin/finance/chargebacks/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/chargebacks/[id] | app/api/admin/finance/chargebacks/[id]/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/finance/commissions | app/api/admin/finance/commissions/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/commissions/[id]/approve | app/api/admin/finance/commissions/[id]/approve/route.ts | withApiHandler | no | requireAdminSession | yes | no |
| /api/admin/finance/commissions/[id]/paid | app/api/admin/finance/commissions/[id]/paid/route.ts | withApiHandler | no | requireAdminSession | yes | no |
| /api/admin/finance/expense-templates | app/api/admin/finance/expense-templates/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/finance/expense-templates/[id] | app/api/admin/finance/expense-templates/[id]/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/expenses | app/api/admin/finance/expenses/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/expenses/[id] | app/api/admin/finance/expenses/[id]/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/invoices | app/api/admin/finance/invoices/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/invoices/[id]/cancel | app/api/admin/finance/invoices/[id]/cancel/route.ts | withApiHandler | no | requireAdminSession | yes | no |
| /api/admin/finance/invoices/[id]/paid | app/api/admin/finance/invoices/[id]/paid/route.ts | withApiHandler | no | requireAdminSession | yes | no |
| /api/admin/finance/ledger | app/api/admin/finance/ledger/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/ledger/adjustment | app/api/admin/finance/ledger/adjustment/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/finance/ledger/reconcile | app/api/admin/finance/ledger/reconcile/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/finance/payouts | app/api/admin/finance/payouts/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/payouts/[id]/paid | app/api/admin/finance/payouts/[id]/paid/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/finance/profile-commissions | app/api/admin/finance/profile-commissions/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/reconciliation | app/api/admin/finance/reconciliation/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/reconciliation/mark | app/api/admin/finance/reconciliation/mark/route.ts | withApiHandler | yes | requireAdminSession | yes | no |
| /api/admin/finance/reports | app/api/admin/finance/reports/route.ts | withApiHandlerResponse, withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/reports/accounts-payable | app/api/admin/finance/reports/accounts-payable/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/reports/dre | app/api/admin/finance/reports/dre/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/summary | app/api/admin/finance/summary/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/finance/wallet-transactions | app/api/admin/finance/wallet-transactions/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/fipe/brands | app/api/admin/fipe/brands/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/fipe/models | app/api/admin/fipe/models/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/fipe/sync | app/api/admin/fipe/sync/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/integrations/correios | app/api/admin/integrations/correios/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/integrations/correios/rotulo | app/api/admin/integrations/correios/rotulo/route.ts | withApiHandlerResponse, withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/integrations/correios/sync-tracking | app/api/admin/integrations/correios/sync-tracking/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/integrations/correios/test | app/api/admin/integrations/correios/test/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/integrations/mercadopago | app/api/admin/integrations/mercadopago/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/integrations/mercadopago/test-webhook | app/api/admin/integrations/mercadopago/test-webhook/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/knowledge-base | app/api/admin/knowledge-base/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/knowledge-base/[id] | app/api/admin/knowledge-base/[id]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/ops/collectors | app/api/admin/ops/collectors/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/exceptions | app/api/admin/ops/exceptions/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/kpis | app/api/admin/ops/kpis/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/pickups | app/api/admin/ops/pickups/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/receptions | app/api/admin/ops/receptions/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/shipments | app/api/admin/ops/shipments/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/shipments/[id] | app/api/admin/ops/shipments/[id]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/ops/shipments/[id]/pickup-request | app/api/admin/ops/shipments/[id]/pickup-request/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/ops/shipments/[id]/reprocess | app/api/admin/ops/shipments/[id]/reprocess/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/ops/shipments/[id]/timeline | app/api/admin/ops/shipments/[id]/timeline/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/payment-gateway/config | app/api/admin/payment-gateway/config/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/payment-transactions/[id]/force-approve | app/api/admin/payment-transactions/[id]/force-approve/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/payment-transactions/pending | app/api/admin/payment-transactions/pending/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/payment-transactions/sync | app/api/admin/payment-transactions/sync/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/pickup-points | app/api/admin/pickup-points/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/pickup-points/[id] | app/api/admin/pickup-points/[id]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/pickup-points/[id]/receptions | app/api/admin/pickup-points/[id]/receptions/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/pickup-points/[id]/reset-password | app/api/admin/pickup-points/[id]/reset-password/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/pickup-points/[id]/status | app/api/admin/pickup-points/[id]/status/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/staff/users | app/api/admin/staff/users/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/staff/users/[id] | app/api/admin/staff/users/[id]/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/staff/users/[id]/reset | app/api/admin/staff/users/[id]/reset/route.ts | withApiHandler | no | requireAdminSession | yes | no |
| /api/admin/staff/users/[id]/status | app/api/admin/staff/users/[id]/status/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/support/tickets | app/api/admin/support/tickets/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/support/tickets/[id] | app/api/admin/support/tickets/[id]/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/support/tickets/[id]/assign | app/api/admin/support/tickets/[id]/assign/route.ts | withApiHandler | yes | requireAdminSession | no | no |
| /api/admin/support/tickets/[id]/reply | app/api/admin/support/tickets/[id]/reply/route.ts | withApiHandler | no | requireAdminSession | no | no |
| /api/admin/support/tickets/[id]/status | app/api/admin/support/tickets/[id]/status/route.ts | withApiHandler | yes | requireAdminSession | no | no |

### assistant
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/assistant/chat | app/api/assistant/chat/route.ts | withApiHandler | yes | getUserFromRequest | yes | no |
| /api/assistant/sessions | app/api/assistant/sessions/route.ts | withApiHandler | no | getUserFromRequest | no | no |
| /api/assistant/sessions/[id] | app/api/assistant/sessions/[id]/route.ts | withApiHandler | no | getUserFromRequest | no | no |

### auth
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/auth/forgot-password | app/api/auth/forgot-password/route.ts | withApiHandler | yes | none | yes | no |
| /api/auth/google | app/api/auth/google/route.ts | withApiHandlerResponse, withApiHandler | no | none | no | no |
| /api/auth/google/callback | app/api/auth/google/callback/route.ts | withApiHandlerResponse, withApiHandler | no | none | no | no |
| /api/auth/heartbeat | app/api/auth/heartbeat/route.ts | none | no | none | no | no |
| /api/auth/login | app/api/auth/login/route.ts | withApiHandlerResponse, withApiHandler | yes | none | yes | no |
| /api/auth/logout | app/api/auth/logout/route.ts | withApiHandlerResponse, withApiHandler | no | getSession | no | no |
| /api/auth/me | app/api/auth/me/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/auth/refresh | app/api/auth/refresh/route.ts | none | no | none | yes | no |
| /api/auth/register | app/api/auth/register/route.ts | withApiHandler | yes | none | yes | no |
| /api/auth/resend-verification | app/api/auth/resend-verification/route.ts | withApiHandler | yes | none | yes | no |
| /api/auth/reset-password | app/api/auth/reset-password/route.ts | withApiHandler | yes | none | yes | no |
| /api/auth/verify-email | app/api/auth/verify-email/route.ts | withApiHandler | no | none | yes | no |

### cart
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/cart | app/api/cart/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/cart/[id]/unlock | app/api/cart/[id]/unlock/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/cart/checkout | app/api/cart/checkout/route.ts | withApiHandler | yes | getSession | no | no |
| /api/cart/checkout-paid | app/api/cart/checkout-paid/route.ts | withApiHandler | yes | none | yes | no |
| /api/cart/items | app/api/cart/items/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/cart/items/[id] | app/api/cart/items/[id]/route.ts | withApiHandler | yes | requireUserSession | no | no |

### cep
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/cep/[cep] | app/api/cep/[cep]/route.ts | withApiHandler | no | none | no | no |

### checkout
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/checkout | app/api/checkout/route.ts | withApiHandler | yes | none | yes | yes |

### coletas
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/coletas | app/api/coletas/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/coletas/[id] | app/api/coletas/[id]/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/coletas/[id]/manifest | app/api/coletas/[id]/manifest/route.ts | withApiHandlerResponse, withApiHandler | no | requireUserSession | no | no |

### coletor
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/coletor/reset-password | app/api/coletor/reset-password/route.ts | withApiHandler | yes | none | no | no |

### coletores
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/coletores/auth/confirm-email | app/api/coletores/auth/confirm-email/route.ts | withApiHandlerResponse, withApiHandler | no | none | no | no |
| /api/coletores/auth/login | app/api/coletores/auth/login/route.ts | withApiHandlerResponse, withApiHandler | yes | none | yes | no |
| /api/coletores/auth/logout | app/api/coletores/auth/logout/route.ts | withApiHandlerResponse, withApiHandler | no | getAutonomousCollectorSession | no | no |
| /api/coletores/auth/me | app/api/coletores/auth/me/route.ts | withApiHandler | no | requireCollectorSession | no | no |
| /api/coletores/auth/register | app/api/coletores/auth/register/route.ts | withApiHandler | yes | none | yes | no |
| /api/coletores/auth/verify-email | app/api/coletores/auth/verify-email/route.ts | withApiHandler | yes | none | yes | no |
| /api/coletores/coletas | app/api/coletores/coletas/route.ts | withApiHandler | no | getAutonomousCollectorSession | no | no |
| /api/coletores/coletas-realizadas | app/api/coletores/coletas-realizadas/route.ts | withApiHandler | no | getAutonomousCollectorSession | no | no |
| /api/coletores/coletas-realizadas/entregar | app/api/coletores/coletas-realizadas/entregar/route.ts | withApiHandler | yes | getAutonomousCollectorSession | no | no |
| /api/coletores/coletas/[id]/agendar | app/api/coletores/coletas/[id]/agendar/route.ts | withApiHandler | no | getAutonomousCollectorSession | no | no |
| /api/coletores/coletas/[id]/registrar | app/api/coletores/coletas/[id]/registrar/route.ts | withApiHandler | yes | getAutonomousCollectorSession | no | no |
| /api/coletores/coletas/[id]/registrar-tentativa | app/api/coletores/coletas/[id]/registrar-tentativa/route.ts | withApiHandler | yes | getAutonomousCollectorSession | no | no |
| /api/coletores/dashboard | app/api/coletores/dashboard/route.ts | withApiHandler | no | getAutonomousCollectorSession | no | no |
| /api/coletores/documentos | app/api/coletores/documentos/route.ts | withApiHandler | yes | none | no | no |
| /api/coletores/suporte | app/api/coletores/suporte/route.ts | withApiHandler | yes | getAutonomousCollectorSession | no | no |
| /api/coletores/suporte/[id] | app/api/coletores/suporte/[id]/route.ts | withApiHandler | no | getAutonomousCollectorSession | no | no |
| /api/coletores/suporte/[id]/mensagens | app/api/coletores/suporte/[id]/mensagens/route.ts | withApiHandler | yes | getAutonomousCollectorSession | no | no |

### correios-agencies
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/correios-agencies/nearby | app/api/correios-agencies/nearby/route.ts | withApiHandler | no | getUserFromRequest | no | no |

### cotacoes
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/cotacoes | app/api/cotacoes/route.ts | withApiHandler | yes | requireUserSession | yes | no |
| /api/cotacoes/[id] | app/api/cotacoes/[id]/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/cotacoes/selecionar | app/api/cotacoes/selecionar/route.ts | withApiHandler | yes | requireUserSession | no | no |

### cron
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/cron/pix-monitor | app/api/cron/pix-monitor/route.ts | withApiHandler | no | none | no | no |
| /api/cron/recipient-payment-expiration | app/api/cron/recipient-payment-expiration/route.ts | withApiHandler | no | none | no | no |

### dashboard
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/dashboard/pending-pickup-shipments | app/api/dashboard/pending-pickup-shipments/route.ts | withApiHandler | no | getUserFromRequest | no | no |

### faq
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/faq | app/api/faq/route.ts | withApiHandler | no | none | no | no |
| /api/faq/[id]/feedback | app/api/faq/[id]/feedback/route.ts | withApiHandler | yes | none | no | no |

### geocode
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/geocode | app/api/geocode/route.ts | withApiHandler | no | none | no | no |

### health
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/health | app/api/health/route.ts | withApiHandler | no | none | no | no |
| /api/health/db | app/api/health/db/route.ts | withApiHandler | no | none | no | no |
| /api/health/dependencies | app/api/health/dependencies/route.ts | withApiHandler | no | none | no | no |

### labels
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/labels | app/api/labels/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/labels/[id] | app/api/labels/[id]/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/labels/[id]/pdf | app/api/labels/[id]/pdf/route.ts | withApiHandlerResponse, withApiHandler | no | none | no | no |

### nfe
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/nfe/parse | app/api/nfe/parse/route.ts | withApiHandler | yes | getUserFromRequest | no | no |

### packages
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/packages/[id]/cancel | app/api/packages/[id]/cancel/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/packages/[id]/pdf | app/api/packages/[id]/pdf/route.ts | withApiHandlerResponse, withApiHandler | no | none | no | no |

### packaging
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/packaging | app/api/packaging/route.ts | withApiHandler | yes | getUserFromRequest | no | no |
| /api/packaging/[id] | app/api/packaging/[id]/route.ts | withApiHandler | yes | getUserFromRequest | no | no |

### payments
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/payments/[id] | app/api/payments/[id]/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/payments/[id]/refresh | app/api/payments/[id]/refresh/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/payments/[id]/refund | app/api/payments/[id]/refund/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/payments/mercadopago/create | app/api/payments/mercadopago/create/route.ts | withApiHandler | yes | getSession | no | no |
| /api/payments/mercadopago/public-key | app/api/payments/mercadopago/public-key/route.ts | withApiHandler | no | none | no | no |

### pickup-fee
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/pickup-fee/calculate | app/api/pickup-fee/calculate/route.ts | withApiHandler | yes | getUserFromRequest | no | no |

### pickup-points
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/pickup-points | app/api/pickup-points/route.ts | withApiHandler | no | getUserFromRequest | no | no |

### pontos-coleta
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/pontos-coleta/auth/login | app/api/pontos-coleta/auth/login/route.ts | withApiHandlerResponse, withApiHandler | yes | none | yes | no |
| /api/pontos-coleta/auth/logout | app/api/pontos-coleta/auth/logout/route.ts | withApiHandlerResponse, withApiHandler | no | none | no | no |
| /api/pontos-coleta/auth/me | app/api/pontos-coleta/auth/me/route.ts | withApiHandler | no | requirePickupPointSession | no | no |
| /api/pontos-coleta/dashboard | app/api/pontos-coleta/dashboard/route.ts | withApiHandler | no | requireCollectorSession, getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/receptions | app/api/pontos-coleta/receptions/route.ts | withApiHandler | no | getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/receptions/[id]/receive | app/api/pontos-coleta/receptions/[id]/receive/route.ts | withApiHandler | yes | requireCollectorSession, getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/receptions/[id]/register-entry | app/api/pontos-coleta/receptions/[id]/register-entry/route.ts | withApiHandler | yes | getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/receptions/volumes/[id]/check | app/api/pontos-coleta/receptions/volumes/[id]/check/route.ts | withApiHandler | no | getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/receptions/volumes/[id]/divergence | app/api/pontos-coleta/receptions/volumes/[id]/divergence/route.ts | withApiHandler | yes | getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/tickets | app/api/pontos-coleta/tickets/route.ts | withApiHandler | yes | getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/tickets/[id] | app/api/pontos-coleta/tickets/[id]/route.ts | withApiHandler | no | getCollectorSessionFromRequest | no | no |
| /api/pontos-coleta/tickets/[id]/messages | app/api/pontos-coleta/tickets/[id]/messages/route.ts | withApiHandler | no | getCollectorSessionFromRequest | no | no |

### public
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/public/carrier-icons | app/api/public/carrier-icons/route.ts | withApiHandler | no | none | no | no |
| /api/public/fipe/brands | app/api/public/fipe/brands/route.ts | withApiHandler | no | none | no | no |
| /api/public/fipe/models | app/api/public/fipe/models/route.ts | withApiHandler | no | none | no | no |
| /api/public/track/[code] | app/api/public/track/[code]/route.ts | withApiHandler | no | none | no | no |
| /api/public/upload/collector-document | app/api/public/upload/collector-document/route.ts | withApiHandler | yes | none | yes | no |

### recipient-payment
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/recipient-payment/[token] | app/api/recipient-payment/[token]/route.ts | withApiHandler | no | none | no | no |
| /api/recipient-payment/cancel | app/api/recipient-payment/cancel/route.ts | withApiHandler | yes | getSession | no | no |
| /api/recipient-payment/create | app/api/recipient-payment/create/route.ts | withApiHandler | yes | getSession | no | no |
| /api/recipient-payment/create-payment | app/api/recipient-payment/create-payment/route.ts | withApiHandler | yes | none | no | no |
| /api/recipient-payment/list | app/api/recipient-payment/list/route.ts | withApiHandler | yes | getSession | no | no |
| /api/recipient-payment/pay | app/api/recipient-payment/pay/route.ts | withApiHandler | yes | none | no | no |
| /api/recipient-payment/refresh-status | app/api/recipient-payment/refresh-status/route.ts | withApiHandler | yes | none | no | no |
| /api/recipient-payment/resend | app/api/recipient-payment/resend/route.ts | withApiHandler | yes | getSession | no | no |

### recurring-items
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/recurring-items | app/api/recurring-items/route.ts | withApiHandler | yes | getUserFromRequest | no | no |
| /api/recurring-items/[id] | app/api/recurring-items/[id]/route.ts | withApiHandler | yes | getUserFromRequest | no | no |
| /api/recurring-items/import | app/api/recurring-items/import/route.ts | withApiHandler | no | getUserFromRequest | no | no |
| /api/recurring-items/search | app/api/recurring-items/search/route.ts | withApiHandler | no | getUserFromRequest | no | no |

### shipments
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/shipments | app/api/shipments/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/shipments/[id] | app/api/shipments/[id]/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/shipments/[id]/cancel | app/api/shipments/[id]/cancel/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/shipments/[id]/declaracao-conteudo | app/api/shipments/[id]/declaracao-conteudo/route.ts | withApiHandlerResponse, withApiHandler | no | requireUserSession | no | no |
| /api/shipments/[id]/divergences | app/api/shipments/[id]/divergences/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/shipments/[id]/payment | app/api/shipments/[id]/payment/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/shipments/create-paid | app/api/shipments/create-paid/route.ts | withApiHandler | yes | none | yes | no |

### support
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/support/tickets | app/api/support/tickets/route.ts | withApiHandler | yes | getUserFromRequest | no | no |
| /api/support/tickets/[id] | app/api/support/tickets/[id]/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/support/tickets/[id]/attachments | app/api/support/tickets/[id]/attachments/route.ts | withApiHandler | no | getSession | no | no |
| /api/support/tickets/[id]/messages | app/api/support/tickets/[id]/messages/route.ts | withApiHandler | no | requireUserSession | no | no |

### system
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/system/status | app/api/system/status/route.ts | withApiHandler | yes | none | no | no |

### tracking
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/tracking | app/api/tracking/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/tracking/sync-all | app/api/tracking/sync-all/route.ts | withApiHandler | no | requireUserSession | no | no |

### tracking-codes
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/tracking-codes/reserve | app/api/tracking-codes/reserve/route.ts | withApiHandler | yes | getUserFromRequest | no | no |

### uploads
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/uploads/[...path] | app/api/uploads/[...path]/route.ts | withApiHandlerResponse, withApiHandler | no | requireUserSession, getAdminSessionFromRequest | no | no |

### user
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/user/preferences | app/api/user/preferences/route.ts | withApiHandler | yes | getUserFromRequest | no | no |

### wallet
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/wallet | app/api/wallet/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/wallet/debit | app/api/wallet/debit/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/wallet/resolve-debt | app/api/wallet/resolve-debt/route.ts | withApiHandler | yes | requireUserSession | no | no |
| /api/wallet/statement/download | app/api/wallet/statement/download/route.ts | withApiHandlerResponse, withApiHandler | no | getSession | no | no |
| /api/wallet/statement/pdf | app/api/wallet/statement/pdf/route.ts | withApiHandlerResponse, withApiHandler | no | getSession | no | no |
| /api/wallet/status | app/api/wallet/status/route.ts | withApiHandler | no | requireUserSession | no | no |
| /api/wallet/transactions | app/api/wallet/transactions/route.ts | withApiHandler | no | requireUserSession | no | no |

### webhooks
| Route | File | Wrapper | Zod | Auth | Rate limit | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| /api/webhooks/mercadopago | app/api/webhooks/mercadopago/route.ts | withApiHandler | yes | none | no | no |
| /api/webhooks/tracking | app/api/webhooks/tracking/route.ts | withApiHandler | yes | none | no | no |

