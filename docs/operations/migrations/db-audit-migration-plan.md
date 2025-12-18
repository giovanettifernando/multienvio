## Plano de Migrações – Auditoria de DB (Envio Legal)

Este plano descreve **estratégias e passos**, não migrations concretas.
Nenhuma migration deve ser criada/aplicada antes de:
- Coletar evidências (via `rg` + queries em produção).
- Aprovação explícita.

---

## 1. Estratégia em Fases

### 1.1 Fase 1 — Preparação

Objetivos:
- Garantir que todas as alterações planejadas sejam **seguras** e **reversíveis**.
- Adicionar índices/constraints não disruptivos.
- Coletar telemetria/logs para confirmar não uso de campos suspeitos.

Passos gerais:
- **1.A – Adicionar índices/constraints seguros**
  - Índices adicionais só se houver evidência de consultas frequentes sem suporte adequado.
  - Exemplo (caso se confirme uso pesado por CEP em `shipments`):
    - `CREATE INDEX CONCURRENTLY IF NOT EXISTS shipments_destinationCep_idx ON shipments("destinationCep");`
  - Usar sempre modo `CONCURRENTLY` em produção para evitar lock agressivo.

- **1.B – Telemetria para campos suspeitos**
  - Instrumentar o código para logar qualquer acesso a colunas marcadas como `UNUSED/SUSPECT`:
    - Ex.: logar quando `defaultPostingUnitId` for lido/escrito (caso algum uso apareça no futuro).
  - Guardar logs por pelo menos 1–2 releases.

- **1.C – Inventário e validação em produção**
  - Para cada coluna potencialmente removível:
    - Rodar queries de densidade (`COUNT(*) FILTER (WHERE col IS NOT NULL)`).
    - Verificar triggers/views/materialized views que referenciam o campo.
    - Checar com time de produto/ops/BI se há relatórios manuais dependentes.

### 1.2 Fase 2 — Deprecação

Objetivos:
- **Parar de depender** de campos candidatos antes de removê-los do schema.

Padrões:
- **Deprecação de campos WRITE_ONLY**:
  - Parar de escrever neles no código (remover da `data` de `create/update`).
  - Não remover ainda do schema Prisma ou do banco.
  - Adicionar comentários no código e no schema (`/// @deprecated`) para desincentivar uso futuro.

- **Deprecação de campos UNUSED/SUSPECT**:
  - Confirmado que não há uso real:
    - Remover do DTO/serialização de respostas (para não vazar dados desnecessários).
    - Manter coluna apenas em nível de banco por um ciclo de release.
  - Comunicar times que qualquer relatório/consulta manual deve parar de usar esses campos.

Período sugerido:
- Manter a fase de deprecação por **1–2 ciclos de release** (dev → hml → prod) antes da remoção definitiva.

### 1.3 Fase 3 — Remoção

Objetivos:
- Remover com segurança campos/tabelas inutilizados ou supérfluos.

Passos:
- Criar migration Prisma **específica** para cada grupo de campos.
- Atualizar `schema.prisma` removendo os campos.
- Atualizar testes unitários e e2e para não dependerem dos campos.
- Implantar em ordem: **dev → hml → prod**, observando métricas e erros de runtime.

---

## 2. Mudanças planejadas por coluna/tabela

> Esta seção lista **mudanças concretas sugeridas**, com tipo, risco, pré-condições, validação e rollback.

### 2.1 `User.defaultPostingUnitId`

- **Tabela/coluna**:
  - Tabela: `users`
  - Coluna: `defaultPostingUnitId` (Prisma) / `default_posting_unit_id` (possível nome em DB, a confirmar)
- **Tipo de alteração**:
  - `DROP COLUMN` (remoção de coluna não utilizada).
- **Justificativa**:
  - Não há ocorrências em:
    - Código TypeScript: `rg "defaultPostingUnitId" -t ts app lib scripts tests-v2`
    - DTOs/UI: nenhum uso em `components/**`.
  - Não há FK associada, nem relacionamentos definidos em Prisma.
- **Risco**: **Médio/Alto** (SUSPECT)
  - Possível uso em:
    - Relatórios manuais (consultas SQL diretas).
    - Scripts ou integrações fora deste repo.

#### 2.1.1 Pré-condições para executar

1. **Verificação em código**:
   - Confirmar:
     ```bash
     rg "defaultPostingUnitId" -n -t ts app lib scripts tests-v2
     rg "default_posting_unit_id" -n -g'*.sql' prisma
     ```
   - Se qualquer uso for encontrado, reclassificar o campo (não remover).

2. **Verificação em produção (dev/hml/prod)**:
   - Medir densidade de preenchimento:
     ```sql
     SELECT
       COUNT(*)                               AS total,
       COUNT(*) FILTER (WHERE default_posting_unit_id IS NOT NULL) AS with_value
     FROM users;
     ```
   - Entrevistar time de produto/ops/BI sobre uso em relatórios.

3. **Período de deprecação**:
   - Se houver valores não nulos mas sem uso conhecido:
     - Comunicar que a coluna será descontinuada.
     - Manter coluna por ao menos 1 release após comunicação.

#### 2.1.2 Migração planejada (fase 3)

- **Migration (conceitual)**:
  - Prisma schema:
    - Remover o campo `defaultPostingUnitId` do model `User`.
  - SQL efetivo (exemplo, a ser gerado pelo Prisma):
    ```sql
    ALTER TABLE "users" DROP COLUMN IF EXISTS "default_posting_unit_id";
    ```

- **Validação pós-migração**:
  - Rodar testes automatizados.
  - Executar queries de sanidade:
    ```sql
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'default_posting_unit_id';
    -- Deve retornar 0 linhas
    ```
  - Verificar logs de erro de aplicação (particularmente endpoints de conta/shipments).

- **Rollback (quando possível)**:
  - Recriar coluna com tipo anterior:
    ```sql
    ALTER TABLE "users" ADD COLUMN "default_posting_unit_id" TEXT;
    ```
  - Reintroduzir o campo em `schema.prisma` com `String?`.
  - Atenção: valores antigos serão perdidos se não houver backup.

---

## 3. Ajustes não destrutivos (opcionais)

### 3.1 Índices adicionais em `shipments` (se necessário)

- **Situação**:
  - Se for verificado uso frequente de filtros por `originCep` ou `destinationCep` em relatórios/admin.

- **Sugestão de alteração**:
  - Tipo: `ADD INDEX` (não destrutivo).
  - Exemplo:
    ```sql
    CREATE INDEX CONCURRENTLY IF NOT EXISTS "shipments_destinationCep_idx"
    ON "shipments"("destinationCep");

    CREATE INDEX CONCURRENTLY IF NOT EXISTS "shipments_originCep_idx"
    ON "shipments"("originCep");
    ```

- **Risco**: Baixo
  - Indíces podem ser removidos posteriormente se não forem usados.

- **Pré-condições**:
  - Confirmar via `EXPLAIN ANALYZE` que consultas atuais por CEP estão fazendo `Seq Scan`.

- **Validação**:
  - Reexecutar consultas pesadas e comparar planos antes/depois.

- **Rollback**:
  ```sql
  DROP INDEX CONCURRENTLY IF EXISTS "shipments_destinationCep_idx";
  DROP INDEX CONCURRENTLY IF EXISTS "shipments_originCep_idx";
  ```

---

## 4. Campos WRITE_ONLY / Auditoria (não remover agora)

Para campos como:
- `User.passwordHistory`, `User.passwordUpdatedAt`
- `Expense.createdBy`, `ExpenseTemplate.createdBy`
- `PlatformCommission.updatedById`

Recomendação:
- **Nenhuma migration destrutiva** neste momento.
- Ações possíveis:
  - Documentar no código/schema (`/// @internal audit-only`) que são campos de auditoria.
  - Garantir que não sejam retornados em DTOs públicos (checagem de segurança).

---

## 5. Fluxo de implantação (por ambiente)

### 5.1 Dev

- Aplicar migrations propostas primeiro em dev:
  - Validar execução sem erro.
  - Rodar toda a suíte de testes (`tests-v2`, e2e).
  - Explorar principais telas/admin manualmente.

### 5.2 Homologação (hml)

- Repetir processo de dev com base em snapshot de dados mais próximo de produção.
- Monitorar logs de erro e dashboards por pelo menos alguns dias úteis.

### 5.3 Produção

- Agendar janela de implantação (se necessário).
- Aplicar migrations:
  - Usar `prisma migrate deploy` com monitoramento.
- Pós-go live:
  - Monitorar:
    - Logs de erro.
    - Painéis críticos (envios, financeiro, checkouts).
  - Ter plano de rollback pronto (incluindo recreate de colunas, quando aplicável).

---

## 6. Próximos passos sugeridos

1. **Confirmar com o time**:
   - Se a análise sobre `User.defaultPostingUnitId` procede e se há conhecimento de uso externo.
2. **Rodar evidências automáticas**:
  - Executar os comandos de `../../audits/database/db-audit-evidence.md` para o campo em questão.
3. **Decidir escopo da primeira leva de migrações**:
   - Começar apenas com 1–2 campos de baixo impacto (no máximo).
4. **Criar RFC interna / PR de design**:
   - Incluir este plano + evidências e colher aprovação antes de qualquer migration.

Nenhuma mudança aqui é mandatória; todas dependem da sua aprovação explícita antes de gerar migrations reais.

