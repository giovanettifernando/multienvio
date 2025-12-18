## Introdução
- Revisão pós-correções do schema Prisma para encontrar colunas/tabelas pouco usadas ou sem uso aparente.

## Objetivo da análise
- Mapear campos/tabelas de banco após remoções recentes (ex.: campos Mercado Pago, health checks) e identificar sobras.
- Classificar se cada campo é usado em fluxos reais, apenas em tipos, ou permanece sem referência.

## Arquivos de schema considerados
- `prisma/schema.prisma`
- Migrations SQL em `prisma/migrations/**/migration.sql` (20251115200000_init até 20251204000000_unique_open_cart_per_user).

## Limitações
- Análise estática por busca de texto; usos indiretos ou dinâmicos podem não aparecer.
- Relations inversas do Prisma não criam colunas; destaquei apenas quando a ausência de include/uso indica que estão ociosas.
- Campos mencionados apenas em validações/tipos podem ser preparação para features futuras; marquei como suspeitos, não como certeza de remoção.

## Metodologia de análise
- Parse automático do `schema.prisma` (57 modelos, 850 campos) para listar colunas/relations.
- Buscas `rg` em todo o código (excluindo schema/migrations/docs) para localizar leituras/escritas por nome de campo.
- Revisão manual dos arquivos que manipulam cada tabela suspeita para confirmar ausência de set/get.

## Critérios das categorias
- **USADO_COMPLETO**: lido ou escrito em fluxos reais.
- **ESCRITO_MAS_NAO_LIDO**: gravado mas não consultado.
- **LIDO_MAS_NAO_ESCRITO**: consultado sem gravação aparente.
- **APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS**: só aparece em tipos/validações/docs.
- **SEM_USO_APARENTE**: não encontrei uso fora da definição (ou fica sempre nulo).

## Resumo geral
- Tabelas analisadas: 57. Campos totais: 850.
- Campos por categoria (apenas suspeitos listados abaixo):
  - SEM_USO_APARENTE: 6
  - APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS: 2 tabelas (PaymentRefund, PaymentChargeback) => 13 campos
- Tabelas com maior concentração de suspeitos: `Address`, `PaymentTransaction`/`LedgerEntry`, `CarrierApiCall`, e tabelas `PaymentRefund`/`PaymentChargeback` (sem fluxos).

## Detalhamento por tabela/modelo

### Address (endereços)
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| name | String? | SEM_USO_APARENTE | Não usado em `app/api/account/addresses/*` nem em selects | Formulários/API nunca enviam ou retornam o nome salvo no endereço. |
| cpfCnpj | String? | SEM_USO_APARENTE | Não setado em creates/updates de endereço; apenas tipagem | Campo não persistido nos fluxos atuais de criação/edição de endereço. |
| referencia | String? | SEM_USO_APARENTE | Só em tipagem (`types/address.ts`), não salvo em `app/api/account/addresses/*` | Campo legado; não é escrito nem lido. |
| role | String? | SEM_USO_APARENTE | Ausente em payloads das rotas de endereço | Valor padrão `recipient` nunca é usado para lógica/filtragem. |

### CarrierApiCall
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| requestBody | Json? | SEM_USO_APARENTE | Criado em `lib/integrations/carriers/carrier.service.ts` sem preencher `requestBody` | Coluna sempre nula; não há leitura em relatórios/logs. |

### PaymentTransaction / LedgerEntry
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| ledgerEntries (relation) | Relation | SEM_USO_APARENTE | Não incluído/consultado em nenhum serviço/UI | Relação nunca usada; ledger é manipulado de forma solta. |
| LedgerEntry.transactionId | String? | SEM_USO_APARENTE | `lib/wallet/wallet.service.ts` cria ledger entries sem `transactionId` | Coluna fica sempre null; não há queries filtrando por transactionId. |

### PaymentRefund (tabela inteira)
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| transactionId, externalId, amountCents, reason, status, createdAt, completedAt | Vários | APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS | Definição no schema e validação em `lib/validation/integrations-payments.ts`; sem rotas/serviços | Estrutura prevista, mas não há criação/consulta no código atual. |

### PaymentChargeback (tabela inteira)
| Campo | Tipo | Classificação | Onde aparece | Comentário/hipótese |
| --- | --- | --- | --- | --- |
| transactionId, externalId, reason, amountCents, status, receivedAt | Vários | APENAS_REFERENCIADO_EM_TIPOS_OU_COMENTARIOS | Apenas schema e validação em `lib/validation/integrations-payments.ts` | Ainda não implementado nos fluxos de pagamento; sem gravação/consulta. |

## Lista de CANDIDATOS FORTES à remoção (validar antes)
- Address: `name`, `cpfCnpj`, `referencia`, `role` — nunca gravados/retornados nas rotas de endereço; parecem legados.
- CarrierApiCall.requestBody — coluna sempre nula (fluxo de health check não salva payload).
- LedgerEntry.transactionId + PaymentTransaction.ledgerEntries — vínculo transação↔ledger não é usado; ledger opera desacoplado.
- Tabelas `PaymentRefund` e `PaymentChargeback` — só definidas/validadas, sem rotas ou uso em serviços.

> Remover ou alterar apenas após validação com negócio e conferência manual de dados existentes.

## Recomendações e próximos passos
- Validar com PO/negócio se há roadmap para Refund/Chargeback; caso contrário, criar tarefa para remover tabelas/relations ou implementar fluxo.
- Decidir se endereços devem armazenar `name/cpfCnpj/referencia/role`; se não, planejar migração para drop ou limpar UI/types.
- Se o vínculo LedgerEntry↔PaymentTransaction for desejado, ajustar serviços para preencher `transactionId` e consumir a relação; senão, simplificar o modelo.
- Para CarrierApiCall, definir se devemos registrar `requestBody`; caso não, remover a coluna para reduzir nulos. 
