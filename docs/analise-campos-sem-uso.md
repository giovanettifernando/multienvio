## Introdução
- Análise estática dos modelos Prisma do Envio Legal para identificar colunas possivelmente não utilizadas ou com uso parcial.

## Objetivo da análise
- Mapear campos definidos em schema/migrations.
- Verificar leituras e escritas no código (APIs, serviços, UI, validações, tipos).
- Destacar campos com baixo ou nenhum uso e sugerir próximos passos.

## Arquivos de schema considerados
- `prisma/schema.prisma`
- Migrations SQL em `prisma/migrations/**/migration.sql` (20251115200000_init até 20251204000000_unique_open_cart_per_user).

## Limitações
- Análise estática por busca de texto; usos dinâmicos ou por reflexão podem não aparecer.
- Nomes genéricos (ex.: `status`, `id`) geram ruído; quando havia dúvida, mantive classificação conservadora.
- Relations de lista no Prisma não criam coluna; marquei apenas quando o lado “owner” (coluna real) parece sem uso.

## Metodologia de análise
- Parse dos modelos em `schema.prisma` para listar tabelas (59) e campos (885).
- Buscas com `rg` em todo o repo (excluindo schema/migrations) para localizar leituras/escritas de cada campo.
- Revisão manual dos trechos encontrados para qualificar se o uso é real (fluxo de negócio) ou apenas em tipos/docs.

## Critérios das categorias
- **USADO_COMPLETO**: lido ou escrito em fluxos reais.
- **ESCRITO_MAS_NAO_LIDO**: preenchido em create/update mas não consultado.
- **LIDO_MAS_NAO_ESCRITO**: consultado, mas não encontrado fluxo que grave.
- **APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS**: só aparece em tipos, docs ou comentários.
- **SEM_USO_APARENTE**: não encontrei uso fora da definição (ou apenas refs em migrations/docs).

## Resumo geral
- Tabelas analisadas: 59. Campos totais: 885.
- Campos suspeitos por categoria:
  - SEM_USO_APARENTE: 10
  - LIDO_MAS_NAO_ESCRITO: 2
  - ESCRITO_MAS_NAO_LIDO: 2
  - APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS: 1
- Tabelas com mais concentrados de suspeitos: `Collector` (campos FIPE), `PaymentTransaction` (datas de status e relação com ledger), tabelas de health-check (`CarrierHealthCheck`/`PaymentHealthCheck`), endpoints de integração (campos `lastTestedAt`), `Shipment` (data `publicTrackingAt` nunca usada).

## Detalhamento por tabela

### User
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| mpCustomerId | String? | LIDO_MAS_NAO_ESCRITO | `app/api/payments/mercadopago/card-saved/route.ts` | Usado para consumir customer no MP, mas não há fluxo que preencha o campo. |
| paymentTransactions / receivedShipments / sentShipments / securityEvents / packagingTemplates / passwordResetTokens | Relations | SEM_USO_APARENTE | Apenas em `prisma/schema.prisma` (passwordResetTokens também em docs). | Relations reversas não são referenciadas no código; não impactam colunas, mas indicam ausência de uso via Prisma include. |

### Card
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| mpCardId | String? | LIDO_MAS_NAO_ESCRITO | `app/api/payments/mercadopago/card-saved/route.ts` | Verificado antes de pagar com cartão salvo; não encontrei fluxo que grave o id retornado pelo MP. |

### Shipment
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| publicTrackingAt | DateTime? | SEM_USO_APARENTE | Apenas `prisma/schema.prisma`/migration | Data de publicação do tracking público nunca é lida ou atualizada. |

### PaymentTransaction
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| capturedAt | DateTime? | ESCRITO_MAS_NAO_LIDO | `lib/integrations/payments/payment-transaction.service.ts` | Setado quando status vira `CAPTURED`; não há consultas/retornos usando o timestamp. |
| refundedAt | DateTime? | ESCRITO_MAS_NAO_LIDO | `lib/integrations/payments/payment-transaction.service.ts` | Idem acima para status `REFUNDED`; não lido em relatórios/UI. |
| ledgerEntries | Relation | SEM_USO_APARENTE | Apenas schema/docs | Não há includes ou consultas que atravessem a relação; ledger funciona desacoplado da transação. |

### PaymentChargeback
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| resolvedAt | DateTime? | SEM_USO_APARENTE | Apenas schema/migrations/docs | Nenhum fluxo grava ou lê a data de resolução do chargeback. |

### CarrierEndpoint / PaymentEndpoint
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| lastTestedAt | DateTime? | SEM_USO_APARENTE | Apenas schema/migrations/docs | Não há rotas/serviços que atualizem ou leiam o timestamp do último teste de endpoint. |

### Carrier / PaymentGateway
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| healthChecks (relations) | Relation | SEM_USO_APARENTE | Somente schema/migrations/docs | Tabelas `CarrierHealthCheck` e `PaymentHealthCheck` não são usadas em código ou APIs. |

### CarrierApiCall
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| responseBody | Json? | APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS | Doc em `docs/integrations-backend.md`; tipo auxiliar em `lib/integrations/fipe/client.ts` | Chamadas gravadas em `carrier.service.ts` não persistem o payload de resposta; campo fica sempre nulo. |

### Collector
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| fipeBrandId / fipeModelId | String? | SEM_USO_APARENTE | Apenas schema/migrations | Nenhum fluxo associa coletor a marca/modelo FIPE; tabelas de marcas/modelos são usadas, mas os FKs do coletor não. |
| fipeBrand / fipeModel | Relation | SEM_USO_APARENTE | Apenas schema/migrations | Relations nunca incluídas nas consultas de coletores. |

### Address
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| billingCards | Relation | SEM_USO_APARENTE | Apenas schema | Relação inversa para cartões de cobrança não é utilizada. |

### StaffUser / StaffAuditLog
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| auditLogs (StaffUser) / actor (StaffAuditLog) | Relation | SEM_USO_APARENTE | Apenas schema | Auditoria grava `actorId` via `lib/audit-admin.ts`, mas a relation inversa não é usada. |

## Lista de CANDIDATOS FORTES à remoção (validar antes)
- Shipment.publicTrackingAt (DateTime?) — nunca usado; avalie se o tracking público precisa de timestamp separado.
- CarrierEndpoint.lastTestedAt / PaymentEndpoint.lastTestedAt (DateTime?) — sem gravação/leitura; removíveis se health-check de endpoints não for implementado em breve.
- Carrier.healthChecks / PaymentGateway.healthChecks (relations) e tabelas `CarrierHealthCheck` / `PaymentHealthCheck` — não referenciadas; parecem backlog não iniciado.
- CarrierApiCall.responseBody (Json?) — não populado nas gravações atuais.
- Collector.fipeBrandId / fipeModelId (String?) e relations — FKs sem uso prático nos fluxos de coletores.
- PaymentChargeback.resolvedAt (DateTime?) — não lido/gravado.
- PaymentTransaction.ledgerEntries (relation) — relação não explorada; ledger funciona separado.
- Address.billingCards, StaffUser.auditLogs, StaffAuditLog.actor, User.* relations citadas acima — apenas relações inversas não utilizadas; remover só se quiser simplificar o client Prisma.

> Remover apenas após alinhamento com negócio e conferência manual do banco/telemetria.

## Recomendações e próximos passos
- Validar com PO/negócio se os campos marcados como SEM_USO_APARENTE ainda têm plano de uso (ex.: health-checks de integrações, tracking público).
- Se confirmada obsolescência, criar tarefas de refatoração/remoção em branch dedicada com migrações claras (drop de colunas/tabelas ou limpeza de relations Prisma).
- Para campos marcados como LIDO_MAS_NAO_ESCRITO, revisar se falta fluxo de gravação (ex.: salvar `mpCustomerId`/`mpCardId` ao criar cliente/cartão no MP) ou remover a dependência de leitura.
- Para campos ESCRITO_MAS_NAO_LIDO (datas de captura/estorno), decidir se devem aparecer em relatórios/UI; caso contrário, remover gravação para reduzir complexidade.
