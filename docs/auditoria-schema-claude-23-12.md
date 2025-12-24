RELATÓRIO DE AUDITORIA DO SCHEMA — DB CLEANUP AUDIT

  ---
  1️⃣ TABELA — INVENTÁRIO DO SCHEMA (Resumo por Modelo)

  | Tabela                     | Colunas | Índices         | FKs | Observação                                                                     |
  |----------------------------|---------|-----------------|-----|--------------------------------------------------------------------------------|
  | roles                      | 4       | 1 (unique name) | 0   | ⚠️ LEGADO - Apenas usado em seed e cache, User.roleId não utilizado ativamente |
  | users                      | 24      | 3 unique        | 1   | Algumas colunas suspeitas                                                      |
  | addresses                  | 12      | 2               | 1   | OK                                                                             |
  | cards                      | 13      | 3               | 2   | panCipher uso específico                                                       |
  | recipients                 | 15      | 4               | 1   | OK                                                                             |
  | carts                      | 6       | 1               | 1   | OK                                                                             |
  | cart_items                 | 11      | 1               | 1   | OK                                                                             |
  | shipments                  | 29      | 10              | 2   | OK - campos bem utilizados                                                     |
  | labels                     | 15      | 5               | 1   | OK                                                                             |
  | packages                   | 19      | 4               | 1   | Campos de divergência parcialmente usados                                      |
  | pickup_requests            | 22      | 7               | 3   | companyId questionável                                                         |
  | tracking_events            | 8       | 1               | 1   | OK                                                                             |
  | staff_roles                | 3       | 1 unique        | 0   | OK                                                                             |
  | staff_users                | 14      | 1               | 1   | OK                                                                             |
  | staff_audit_logs           | 6       | 3               | 1   | OK                                                                             |
  | user_security_events       | 7       | 3               | 1   | OK                                                                             |
  | password_reset_tokens      | 6       | 2               | 1   | OK                                                                             |
  | wallets                    | 5       | 1               | 1   | OK                                                                             |
  | wallet_transactions        | 10      | 3               | 1   | OK                                                                             |
  | support_tickets            | 13      | 6               | 3   | OK                                                                             |
  | support_messages           | 6       | 1               | 1   | OK                                                                             |
  | support_attachments        | 6       | 1               | 1   | OK                                                                             |
  | pickup_points              | 23      | 3               | 0   | OK - todos campos usados                                                       |
  | receptions                 | 14      | 4               | 1   | OK                                                                             |
  | quotes                     | 15      | 3               | 1   | OK                                                                             |
  | quote_volumes              | 7       | 1               | 1   | OK                                                                             |
  | quote_options              | 14      | 2               | 1   | OK                                                                             |
  | quote_selections           | 7       | 1               | 1   | OK                                                                             |
  | carriers                   | 12      | 2               | 0   | OK                                                                             |
  | carrier_credentials        | 17      | 1               | 1   | OK                                                                             |
  | payment_gateways           | 12      | 2               | 0   | OK                                                                             |
  | payment_credentials        | 15      | 1               | 1   | OK                                                                             |
  | payment_endpoints          | 10      | 2               | 1   | ⚠️ INCERTO - Uso não claro em runtime                                          |
  | payment_transactions       | 19      | 5               | 2   | OK                                                                             |
  | payment_webhooks           | 13      | 3               | 1   | OK                                                                             |
  | ledger_entries             | 7       | 2               | 0   | OK - Usado em reconciliação                                                    |
  | email_configs              | 10      | 0               | 0   | OK                                                                             |
  | google_oauth_configs       | 5       | 0               | 0   | OK                                                                             |
  | collectors                 | 45      | 6               | 0   | Muitos campos, todos usados                                                    |
  | collector_documents        | 12      | 1               | 1   | OK                                                                             |
  | collector_credentials      | 4       | 0               | 1   | OK                                                                             |
  | packaging_templates        | 7       | 1               | 1   | OK                                                                             |
  | cep_locations              | 8       | 0               | 0   | OK                                                                             |
  | correios_agencies          | 18      | 4               | 0   | OK                                                                             |
  | recurring_items            | 5       | 1               | 1   | OK                                                                             |
  | platform_commissions       | 6       | 0               | 0   | OK                                                                             |
  | fipe_vehicle_brands        | 9       | 2               | 0   | OK                                                                             |
  | fipe_vehicle_models        | 10      | 3               | 1   | OK                                                                             |
  | expenses                   | 19      | 5               | 0   | OK                                                                             |
  | expense_templates          | 11      | 2               | 0   | OK                                                                             |
  | faq_items                  | 12      | 2               | 0   | OK                                                                             |
  | tracking_code_reservations | 6       | 3               | 1   | OK                                                                             |
  | recipient_payment_requests | 37      | 5               | 2   | OK                                                                             |
  | recipient_payment_packages | 6       | 1               | 1   | OK                                                                             |
  | openrouter_configs         | 12      | 0               | 0   | OK                                                                             |
  | assistant_chat_sessions    | 5       | 2               | 1   | OK                                                                             |
  | assistant_chat_messages    | 8       | 2               | 1   | OK                                                                             |
  | knowledge_base_articles    | 9       | 2               | 0   | OK                                                                             |

  ---
  2️⃣ TABELA — CANDIDATOS A REMOÇÃO/CONSOLIDAÇÃO

  | Item                       | Classificação       | Evidência                                                                                                       | Risco          | Ação Sugerida        | Prioridade |
  |----------------------------|---------------------|-----------------------------------------------------------------------------------------------------------------|----------------|----------------------|------------|
  | Role (tabela)              | LEGADO              | Apenas prisma/seed.ts e platform/cache/cache.ts usam. User.roleId nunca é lido/escrito em runtime.              | Baixo          | DEPRECAR → DROP      | 🟢 Alta    |
  | User.roleId                | NÃO USADO           | Coluna existe mas nunca é filtrada/usada. Roles são feitos via StaffUser.permissions                            | Baixo          | DROP após Role       | 🟢 Alta    |
  | User.defaultPostingUnitId  | POSSIVELMENTE USADO | Aparece em PostingUnitPicker.tsx mas lógica é incompleta. Campo escrito mas não lido.                           | Médio          | INVESTIGAR           | 🟡 Média   |
  | User.passwordHistory       | USADO (SEGURANÇA)   | Usado em account-security.service.ts para validar histórico                                                     | ❌ NÃO REMOVER | MANTER               | N/A        |
  | PickupRequest.companyId    | LEGADO              | Campo existe mas coletas/[id]/route.ts e outros sempre passam null                                              | Baixo          | DEPRECAR → DROP      | 🟢 Alta    |
  | PaymentEndpoint (tabela)   | INCERTO             | Modelo existe mas não encontrei uso real em chamadas de API. Talvez seja para config dinâmica não implementada. | Médio          | INVESTIGAR mais      | 🟡 Média   |
  | Label.fileUrl              | USADO               | Armazena URL do PDF, usado em download                                                                          | ❌ NÃO REMOVER | MANTER               | N/A        |
  | Label.fileBase64           | USADO               | Armazena PDF inline, usado em etiquetas                                                                         | ❌ NÃO REMOVER | MANTER               | N/A        |
  | Package.divergencePhotoUrl | ESCRITO, POUCO LIDO | Campo escrito em divergência mas não exibido em UI admin                                                        | Baixo          | MANTER (auditoria)   | N/A        |
  | Address.label              | POUCO USADO         | Opcional para dar nome ao endereço. Só 2 arquivos usam.                                                         | Baixo          | MANTER (feature)     | N/A        |
  | QuoteVolume.cubicWeight    | REDUNDANTE          | Calculável: (h*w*l)/6000. Mas armazenado para performance.                                                      | Baixo          | MANTER (performance) | N/A        |

  ---
  3️⃣ DETALHAMENTO DAS REMOÇÕES RECOMENDADAS

  🔴 ALTA PRIORIDADE — Role/roleId Legado

  Tabela Role + Coluna User.roleId

  Evidência de não uso:
  # Busca por uso de Role em código de produção:
  grep -r "prisma.role" --include="*.ts" --exclude-dir=prisma --exclude-dir=tests
  # Resultado: APENAS platform/cache/cache.ts (cache de admin, não usa roleId do User)

  Análise:
  - User.roleId nunca é lido em nenhuma query
  - Sistema de permissões migrou para StaffUser.permissions (array de enums)
  - Tabela Role só é populada no seed e nunca consultada
  - FK não é utilizada — users podem ter roleId: null

  Risco: BAIXO
  - Não há regra de negócio dependendo de User.role
  - Nenhum relatório filtra por role

  Plano de Remoção:

  Fase 1 (Deprecar):
  1. Adicionar no schema: /// @deprecated - Não usado. Ver StaffUser.permissions
  2. Remover do seed.ts a criação de roles de usuário
  3. Verificar que nenhum código novo usa roleId

  Fase 2 (Remover - PR separado):
  1. Migration: ALTER TABLE users DROP COLUMN "roleId";
  2. Migration: DROP TABLE roles;
  3. Remover model Role do schema.prisma
  4. Remover campo roleId de User
  5. Atualizar cache.ts se necessário

  ---
  🔴 ALTA PRIORIDADE — PickupRequest.companyId

  Evidência:
  // app/api/admin/ops/shipments/[id]/route.ts:204
  companyId: pickupRequest.companyId,  // Sempre null

  // modules/coletas/application/list.service.ts
  // Nunca filtra por companyId

  Análise:
  - Campo existe para futuro suporte multi-tenant (empresas)
  - Nunca foi implementado — sempre null
  - Não há UI para setar companyId

  Risco: BAIXO (sem uso atual)

  Plano de Remoção:
  Fase 1: Confirmar que não há referências no código que setam valor != null
  Fase 2: Migration DROP COLUMN

  ---
  🟡 MÉDIA PRIORIDADE — PaymentEndpoint (Investigar)

  Evidência:
  grep -r "PaymentEndpoint" --include="*.ts" app/ modules/ platform/
  # Poucos resultados, apenas tipos e definições

  Análise:
  - Modelo parece ser para configuração dinâmica de endpoints de gateway
  - Não encontrei uso real em chamadas de API (integrações usam hardcoded)
  - Pode ser design para futura flexibilidade

  Ação: INVESTIGAR antes de remover. Pode ser necessário para novos gateways.

  ---
  4️⃣ CONSTRAINTS AUSENTES (DÉBITO DE SCHEMA)

  | Tabela              | Campo                      | Constraint Faltante                  | Risco Atual                              |
  |---------------------|----------------------------|--------------------------------------|------------------------------------------|
  | wallets             | availableCents             | CHECK (availableCents >= 0)          | ⚠️ Pode ficar negativo em race condition |
  | wallets             | pendingCents               | CHECK (pendingCents >= 0)            | ⚠️ Mesmo problema                        |
  | wallet_transactions | amountCents                | Nenhum (aceita negativo, é esperado) | OK                                       |
  | shipments           | weight                     | CHECK (weight > 0)                   | Baixo (validado em app)                  |
  | packages            | weight/width/height/length | CHECK (val > 0)                      | Baixo                                    |

  Recomendação: Adicionar CHECK (availableCents >= 0) em wallets é CRÍTICO para integridade financeira.

  ---
  5️⃣ ÍNDICES POTENCIALMENTE DESNECESSÁRIOS

  | Tabela     | Índice                                                  | Motivo Suspeito                    | Recomendação                 |
  |------------|---------------------------------------------------------|------------------------------------|------------------------------|
  | wallets    | @@index([userId])                                       | userId já é @unique                | ⚠️ REDUNDANTE - pode remover |
  | recipients | @@index([userId, name]) + @@index([userId, nameSearch]) | Overlap - ambos usam mesmo prefixo | AVALIAR consolidar           |
  | cards      | @@index([userId]) + @@index([userId, isDefault])        | Segundo cobre primeiro             | AVALIAR remover primeiro     |

  ---
  6️⃣ PLANO DE REFATORAÇÃO POR PRs

  PR1: Deprecações (Sem Mudança de Schema)

  Arquivos afetados:
  - prisma/schema.prisma (adicionar /// @deprecated)
  - prisma/seed.ts (remover criação de Role para User)

  Passos:
  1. Marcar Role e User.roleId como @deprecated no schema
  2. Marcar PickupRequest.companyId como @deprecated
  3. Remover criação de userRole no seed
  4. Executar testes

  PR2: Migration — Remover Role/roleId

  Arquivos afetados:
  - prisma/migrations/YYYYMMDD_remove_role_table/migration.sql
  - prisma/schema.prisma

  Migration SQL:
  ALTER TABLE "users" DROP COLUMN IF EXISTS "roleId";
  DROP TABLE IF EXISTS "roles";

  Testes:
  - Verificar que seed ainda funciona
  - Verificar que login/auth funciona
  - Verificar que admin users usa StaffRole (não Role)

  PR3: Migration — Remover companyId

  Migration SQL:
  ALTER TABLE "pickup_requests" DROP COLUMN IF EXISTS "companyId";

  PR4: Adicionar CHECK Constraints (CRÍTICO)

  Migration SQL:
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_available_cents_check" 
    CHECK ("availableCents" >= 0);
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_pending_cents_check"
    CHECK ("pendingCents" >= 0);

  PR5: Cleanup de Índices Redundantes

  Migration SQL:
  DROP INDEX IF EXISTS "wallets_userId_idx";
  -- Avaliar outros após análise de query plans

  ---
  7️⃣ RESUMO EXECUTIVO

  | Categoria                   | Quantidade            | Ação                |
  |-----------------------------|-----------------------|---------------------|
  | Tabelas sem uso             | 1 (Role)              | DROP                |
  | Colunas sem uso             | 2 (roleId, companyId) | DROP                |
  | Colunas redundantes         | 0                     | —                   |
  | Índices redundantes         | 1-3                   | AVALIAR             |
  | CHECK constraints faltantes | 2                     | ADICIONAR (crítico) |
  | Campos "incertos"           | 2                     | INVESTIGAR          |

  Economia estimada:
  - ~100 bytes por row em users (roleId + FK overhead)
  - 1 tabela a menos para manter
  - Schema mais limpo e alinhado com arquitetura atual

  ---

● CONCLUSÃO

  A auditoria identificou que o schema está majoritariamente bem utilizado, com apenas alguns elementos legados:

  ✅ Ação Imediata Recomendada

  1. DROP Role + User.roleId — Totalmente sem uso, legado de arquitetura anterior
  2. DROP PickupRequest.companyId — Sempre null, feature multi-tenant nunca implementada
  3. ADD CHECK constraints em wallets — CRÍTICO para integridade financeira

  ⚠️ Investigar Antes de Remover

  - PaymentEndpoint — Pode ser necessário para futuros gateways
  - User.defaultPostingUnitId — Lógica incompleta mas pode ser feature planejada

  🔒 Não Remover (Confirmado Uso)

  - passwordHistory, passwordUpdatedAt — Segurança ativa
  - panCipher — Usado em tokenização de cartões
  - Label.fileBase64/fileUrl — Armazenamento de etiquetas
  - Campos de divergência em Package — Auditoria de volumes

  O schema está enxuto para um sistema desta complexidade. As remoções propostas são seguras e podem ser feitas em PRs incrementais.

