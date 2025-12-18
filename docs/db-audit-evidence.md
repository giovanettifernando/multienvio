## Evidências Automatizáveis – Auditoria de DB

Este documento lista comandos sugeridos (principalmente `rg`) para confirmar o uso real dos campos/tabelas
e apoiar as classificações do relatório principal (`docs/db-audit-report.md`).

Todos os comandos assumem execução a partir da raiz do projeto:

```bash
cd /home/giovanetti/enviolegalv2
```

---

## 1. Busca geral de uso de models Prisma

Ver todos os lugares onde cada model é referenciado (para mapear uso por tabela):

```bash
rg "prisma\.[A-Za-z0-9_]+\.find" -t ts app lib scripts tests-v2
rg "prisma\.[A-Za-z0-9_]+\.create" -t ts app lib scripts tests-v2
rg "prisma\.[A-Za-z0-9_]+\.update" -t ts app lib scripts tests-v2
rg "prisma\.[A-Za-z0-9_]+\.delete" -t ts app lib scripts tests-v2
rg "prisma\.[A-Za-z0-9_]+\.aggregate" -t ts app lib scripts tests-v2
rg "prisma\.[A-Za-z0-9_]+\.count" -t ts app lib scripts tests-v2
```

Para uma tabela específica (ex.: `shipment`):

```bash
rg "prisma\.shipment\." -n -t ts app lib scripts tests-v2
```

---

## 2. Verificação de campos suspeitos / candidatos a remoção

### 2.1 `User.defaultPostingUnitId`

Confirmar se há qualquer uso no código:

```bash
rg "defaultPostingUnitId" -n -t ts app lib scripts tests-v2
rg "default_posting_unit_id" -n prisma/migrations prisma
```

Se ambos retornarem vazio no código TypeScript (apenas presença em `schema.prisma` e talvez migrations),
reforça a classificação `UNUSED/SUSPECT`.

### 2.2 Campos de histórico de senha (`User.passwordHistory`, `User.passwordUpdatedAt`)

Confirmar se são apenas gravados:

```bash
rg "passwordHistory" -n -t ts app lib scripts tests-v2
rg "passwordUpdatedAt" -n -t ts app lib scripts tests-v2
```

Inspecionar:
- Se aparecem apenas em `data: { passwordHistory: ... }` / `update` → `WRITE_ONLY`.
- Se aparecem em `select`/DTOs/respostas → `READ+WRITE`.

### 2.3 Campos de auditoria genéricos (`createdBy`, `updatedById`)

```bash
rg "\"createdBy\"" -n -t ts app lib scripts tests-v2
rg "\"updatedById\"" -n -t ts app lib scripts tests-v2
```

Avaliar se são usados em:
- Listagens/admin (READ+WRITE).
- Apenas para logging interno (WRITE_ONLY).

---

## 3. Matriz de uso por campo – padrões de busca

Para uma coluna específica (ex.: `status` de `shipments`):

```bash
rg "status\s*:" -n -t ts app/lib -S
rg "\"status\"" -n -t ts app lib scripts tests-v2
rg "status:\s*\"PICKUP_REQUESTED\"" -n -t ts app lib
```

Estratégia:
- **Leitura (READ)**:
  - Presença em `select: { status: true }`, `include`, DTOs, serialização de respostas (`JSON.stringify`, `return { ...status }`).
- **Escrita (WRITE)**:
  - Presença em `create({ data: { status: ... }})`, `update({ data: { status: ... }})`, `updateMany`.
- **Filtro/ordenação (FILTER_ONLY)**:
  - Uso em `where: { status: ... }`, `orderBy: { status: ... }` sem seleção explícita.

Exemplo mais completo para `Shipment.status`:

```bash
rg "shipment.*status" -n -t ts app lib scripts tests-v2
rg "shipments.*status" -n prisma/migrations
```

---

## 4. Raw SQL e acessos fora do Prisma

Confirmar se há queries manuais que usam colunas não vistas via Prisma:

```bash
rg "SELECT " -g'*.sql' prisma/migrations prisma/migrations_backup_20251115_141457
rg "\$queryRaw" -n -t ts app lib scripts
rg "\$executeRaw" -n -t ts app lib scripts
```

Para uma tabela específica (ex.: `users`):

```bash
rg "FROM users" -g'*.sql' prisma
rg "JOIN users" -g'*.sql' prisma
```

---

## 5. UI / Forms / Validações (Zod)

Alguns campos podem ser usados apenas em:
- Formulários de UI.
- Schemas de validação.
- Serialização de DTOs.

### 5.1 Zod / validações

```bash
rg "zod" -l -t ts app lib
rg "z\.object" -n -t ts lib/validation app
```

Para um campo específico (ex.: `razaoSocial`):

```bash
rg "razaoSocial" -n -t ts app lib components
```

### 5.2 Forms e componentes de UI

```bash
rg "defaultPostingUnitId" -n components app -t tsx
rg "pickupFee" -n components app -t tsx
rg "shippingCommissionPercent" -n -t ts app lib components
```

---

## 6. Campos não encontrados no código (lista de exemplo)

> Esta lista é **parcial** e deve ser refinada executando os comandos acima.
> “Não encontrado” aqui significa: sem ocorrências claras em `app/**`, `lib/**`, `scripts/**`, `tests-v2/**` usando `rg`.

- `User.defaultPostingUnitId`
  - Padrões de busca:
    - `rg "defaultPostingUnitId" -n -t ts app lib scripts tests-v2`
    - `rg "default_posting_unit_id" -n prisma/migrations prisma`
  - Se apenas presente no schema/migrations, candidatar a remoção (ver plano de migração).

Para refinar a matriz de campos `UNUSED`/`SUSPECT`, recomenda-se:
- Exportar a lista completa de colunas a partir do `schema.prisma` (via script Node simples ou `jq` sobre introspecção).
- Gerar, para cada coluna, um comando `rg` e armazenar o resultado em um relatório técnico (CSV/JSON).

---

## 7. Checagens em ambiente (dev/hml/prod)

Além dos `rg`, recomenda-se executar queries exploratórias diretamente no Postgres para medir ocupação real dos campos:

### 7.1 Densidade de preenchimento (valores não nulos)

Exemplo para `users.default_posting_unit_id`:

```sql
SELECT
  COUNT(*)                               AS total,
  COUNT(*) FILTER (WHERE default_posting_unit_id IS NOT NULL) AS with_value
FROM users;
```

Campos com `with_value = 0` há muito tempo reforçam a hipótese de campo obsoleto.

### 7.2 Verificar uso em views/materialized views/triggers (se existirem)

```sql
SELECT *
FROM information_schema.triggers
WHERE event_object_table IN ('users', 'shipments', 'wallet_transactions');

SELECT view_definition
FROM information_schema.views
WHERE table_name IN ('users', 'shipments', 'wallet_transactions');
```

Se aparecerem referências a colunas marcadas como `UNUSED` na aplicação, reclassificar como `SUSPECT`.

---

## 8. Como usar este documento

- Use os comandos aqui como “checklist” ao validar cada coluna candidata a alteração.
- Antes de aprovar qualquer remoção:
  - Execute os `rg` correspondentes.
  - Consulte densidade de preenchimento em produção.
  - Verifique dependências externas (BI, relatórios manuais, integrações).

O resultado dessas checagens deve ser registrado como evidência anexada ao plano de migração
(`docs/db-audit-migration-plan.md`) antes de qualquer alteração em PR.


