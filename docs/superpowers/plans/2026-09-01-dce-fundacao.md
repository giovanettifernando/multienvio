# Fundação da DC-e — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a base da DC-e que vale em qualquer cenário futuro — validação da chave de acesso, persistência da chave no envio e bloqueio de declaração de conteúdo sem documento do remetente.

**Architecture:** Três camadas independentes. Um módulo puro de validação em `shared/validation/dce.ts` (sem banco, sem rede, testável direto). Uma coluna `dceKey` no `Shipment`, com validação no servidor. E uma checagem no checkout que impede declaração de conteúdo quando o remetente não tem CPF/CNPJ cadastrado.

**Tech Stack:** TypeScript, Zod, Prisma 7 + PostgreSQL, testes com `node --test` e `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-01-dce-declaracao-conteudo-design.md`

## Global Constraints

- Testes rodam com `pnpm test:unit` (`node --test --require ./tests/register.js "tests/unit/**/*.test.ts"`). Estilo: `import test from 'node:test'` e `import assert from 'node:assert'`, agrupando com `test.describe`.
- Build de produção é `pnpm build:webpack`, **nunca** `pnpm build` — o Turbopack quebra no pacote `@api/loggi-platform`.
- Comandos do Prisma exigem `export DATABASE_URL=...` antes; o Prisma 7 não lê o `.env` neles.
- Migrations: `prisma migrate deploy`. `prisma migrate dev` falha nesta máquina com P3014 (sem permissão para criar shadow database) — aplicar o SQL com `psql` e marcar com `prisma migrate resolve --applied <nome>`.
- Ao alterar o schema do Prisma, o servidor de dev precisa ser reiniciado: ele mantém o client antigo em memória e passa a falhar com "Unknown argument".
- Mensagens ao usuário em português.

---

### Task 1: Módulo de validação da chave de acesso

**Files:**
- Create: `shared/validation/dce.ts`
- Test: `tests/unit/validation/dce.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro, primeira peça)
- Produces:
  - `isValidDceKey(value: string): boolean`
  - `parseDceKey(value: string): DceKeyParts | null`
  - `type DceKeyParts = { cUF: string; anoMes: string; cnpjEmitente: string; modelo: string; serie: string; numero: string; tpEmis: string; tpEmit: string; siteAutorizador: string; codigoNumerico: string; dv: string }`
  - `DCE_MODELO = '99'`

**Contexto para quem implementa:** a chave da DC-e tem 44 dígitos, formados pela concatenação de campos do documento, com dígito verificador módulo 11 — o mesmo algoritmo da NF-e. O que distingue uma DC-e de uma NF-e é o campo `modelo`: `99` na DC-e, `55` na NF-e. Sem essa checagem, um cliente cola a chave da nota fiscal e o sistema aceita.

Composição, na ordem (Manual DC-e — Visão Geral, seção 2.2.4):

| Posições | Campo | Dígitos |
|---|---|---|
| 1-2 | cUF | 2 |
| 3-6 | AAMM | 4 |
| 7-20 | CNPJ do emitente | 14 |
| 21-22 | modelo | 2 |
| 23-25 | série | 3 |
| 26-34 | número | 9 |
| 35 | tpEmis | 1 |
| 36 | tpEmit | 1 |
| 37 | site autorizador | 1 |
| 38-43 | código numérico | 6 |
| 44 | DV | 1 |

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/validation/dce.test.ts`:

```typescript
import assert from 'node:assert';
import test from 'node:test';
import { isValidDceKey, parseDceKey } from '@/shared/validation/dce';

// Chave de DC-e válida (modelo 99), com DV calculado pelo módulo 11.
const CHAVE_VALIDA = '41260912345678000195990010000000421011234561';
// Mesma chave com modelo 55 — é uma NF-e, não uma DC-e.
const CHAVE_NFE = '41260912345678000195550010000000421011234566';
// Mesma chave da DC-e com o último dígito trocado.
const CHAVE_DV_ERRADO = '41260912345678000195990010000000421011234562';

test.describe('validation/dce — isValidDceKey', () => {
  test('aceita chave de DC-e válida', () => {
    assert.equal(isValidDceKey(CHAVE_VALIDA), true);
  });

  test('aceita chave com máscara e espaços', () => {
    assert.equal(isValidDceKey(' 4126 0912 3456 7800 0195 9900 1000 0000 4210 1123 4561 '), true);
  });

  test('rejeita dígito verificador errado', () => {
    assert.equal(isValidDceKey(CHAVE_DV_ERRADO), false);
  });

  test('rejeita chave de NF-e (modelo 55)', () => {
    assert.equal(isValidDceKey(CHAVE_NFE), false);
  });

  test('rejeita comprimento diferente de 44', () => {
    assert.equal(isValidDceKey(CHAVE_VALIDA.slice(0, 43)), false);
    assert.equal(isValidDceKey(CHAVE_VALIDA + '0'), false);
  });

  test('rejeita entrada vazia ou não numérica', () => {
    assert.equal(isValidDceKey(''), false);
    assert.equal(isValidDceKey('abc'), false);
  });
});

test.describe('validation/dce — parseDceKey', () => {
  test('separa os campos da chave', () => {
    const partes = parseDceKey(CHAVE_VALIDA);
    assert.ok(partes);
    assert.equal(partes.cUF, '41');
    assert.equal(partes.anoMes, '2609');
    assert.equal(partes.cnpjEmitente, '12345678000195');
    assert.equal(partes.modelo, '99');
    assert.equal(partes.serie, '001');
    assert.equal(partes.numero, '000000042');
    assert.equal(partes.tpEmis, '1');
    assert.equal(partes.tpEmit, '0');
    assert.equal(partes.siteAutorizador, '1');
    assert.equal(partes.codigoNumerico, '123456');
    assert.equal(partes.dv, '1');
  });

  test('devolve null para chave inválida', () => {
    assert.equal(parseDceKey(CHAVE_DV_ERRADO), null);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `pnpm test:unit 2>&1 | grep -A3 "validation/dce"`
Esperado: FAIL — o módulo `@/shared/validation/dce` não existe.

- [ ] **Step 3: Implementar o módulo**

Criar `shared/validation/dce.ts`:

```typescript
/**
 * Chave de acesso da DC-e (Declaração de Conteúdo eletrônica).
 *
 * São 44 dígitos formados pela concatenação de campos do próprio documento,
 * com dígito verificador módulo 11 — o mesmo algoritmo da NF-e. Referência:
 * Manual DC-e — Visão Geral, seção 2.2.4.
 *
 * O que separa uma DC-e de uma NF-e é o campo `modelo`. Sem conferir isso, uma
 * chave de nota fiscal colada por engano passaria batido: ela tem o mesmo
 * tamanho e o mesmo dígito verificador.
 */

import { onlyDigits } from '@/shared/utils/masks';

/** Modelo do documento na chave de acesso. A NF-e usa '55'. */
export const DCE_MODELO = '99';

export type DceKeyParts = {
  cUF: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  tpEmis: string;
  /** 0=App do Fisco, 1=Marketplace, 2=Emissor próprio, 3=Transportadora */
  tpEmit: string;
  siteAutorizador: string;
  codigoNumerico: string;
  dv: string;
};

/**
 * Dígito verificador módulo 11: cada algarismo, da direita para a esquerda, é
 * multiplicado pela sequência cíclica 2,3,4,5,6,7,8,9. Resto 0 ou 1 resulta em
 * DV zero.
 */
function calcularDv(base43: string): number {
  let soma = 0;
  let peso = 2;

  for (let i = base43.length - 1; i >= 0; i -= 1) {
    soma += Number(base43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

export function isValidDceKey(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length !== 44) return false;
  if (digits.slice(20, 22) !== DCE_MODELO) return false;

  return calcularDv(digits.slice(0, 43)) === Number(digits[43]);
}

export function parseDceKey(value: string): DceKeyParts | null {
  if (!isValidDceKey(value)) return null;

  const d = onlyDigits(value);

  return {
    cUF: d.slice(0, 2),
    anoMes: d.slice(2, 6),
    cnpjEmitente: d.slice(6, 20),
    modelo: d.slice(20, 22),
    serie: d.slice(22, 25),
    numero: d.slice(25, 34),
    tpEmis: d.slice(34, 35),
    tpEmit: d.slice(35, 36),
    siteAutorizador: d.slice(36, 37),
    codigoNumerico: d.slice(37, 43),
    dv: d.slice(43, 44),
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `pnpm test:unit 2>&1 | grep -E "validation/dce|# (pass|fail)"`
Esperado: os 9 testes passam; a contagem de `# fail` do projeto não aumenta.

- [ ] **Step 5: Conferir a tipagem**

Rodar: `pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5`
Esperado: nenhuma saída.

- [ ] **Step 6: Commit**

```bash
git add shared/validation/dce.ts tests/unit/validation/dce.test.ts
git commit -m "feat(dce): validação da chave de acesso da DC-e

44 dígitos, dígito verificador módulo 11 e modelo 99. A checagem do modelo
é o que impede aceitar uma chave de NF-e colada por engano: ela tem o mesmo
tamanho e o mesmo algoritmo de DV, mudando só esse campo.

O exemplo de cálculo do manual oficial usa modelo 55 (é uma NF-e
reaproveitada na documentação), então serve para conferir o DV mas não a
regra do 99 — os casos do 99 foram montados à parte."
```

---

### Task 2: Persistir a chave no envio

**Files:**
- Modify: `prisma/schema.prisma` (model `Shipment`)
- Create: `prisma/migrations/<timestamp>_shipment_dce_key/migration.sql`
- Modify: `modules/shipments/application/create-with-volumes.ts` (interface `ShipmentInput`)
- Modify: `modules/cart/dto/cart.ts` (schema de checkout)
- Test: `tests/unit/validation/dce-checkout.test.ts`

**Interfaces:**
- Consumes: `isValidDceKey` de `@/shared/validation/dce` (Task 1)
- Produces:
  - Coluna `Shipment.dceKey` (`String?`, único)
  - `dceKeySchema` exportado de `@/shared/validation/dce` — schema Zod reutilizável

**Contexto:** a coluna é própria, e não um campo dentro do JSON `document`, porque o checkout será barrado com base nela e ela será consultada. A restrição de unicidade impede que a mesma DC-e seja colada em vários envios — sem ela, um cliente apressado deixa vários envios sem documento válido de verdade.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/validation/dce-checkout.test.ts`:

```typescript
import assert from 'node:assert';
import test from 'node:test';
import { dceKeySchema } from '@/shared/validation/dce';

const CHAVE_VALIDA = '41260912345678000195990010000000421011234561';
const CHAVE_NFE = '41260912345678000195550010000000421011234566';

test.describe('validation/dce — dceKeySchema', () => {
  test('aceita chave válida e devolve só os dígitos', () => {
    const r = dceKeySchema.safeParse(' 4126 0912 3456 7800 0195 9900 1000 0000 4210 1123 4561 ');
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data, CHAVE_VALIDA);
  });

  test('rejeita chave de NF-e com mensagem explicativa', () => {
    const r = dceKeySchema.safeParse(CHAVE_NFE);
    assert.equal(r.success, false);
    if (!r.success) {
      assert.match(r.error.issues[0].message, /DC-e/);
    }
  });

  test('rejeita texto vazio', () => {
    assert.equal(dceKeySchema.safeParse('').success, false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `pnpm test:unit 2>&1 | grep -A3 "dceKeySchema"`
Esperado: FAIL — `dceKeySchema` não é exportado.

- [ ] **Step 3: Adicionar o schema Zod ao módulo**

Primeiro, acrescentar `import { z } from 'zod';` ao topo de
`shared/validation/dce.ts`, junto ao import já existente. Depois, acrescentar ao
final do arquivo:

```typescript
/**
 * Schema da chave, para usar nos payloads de checkout. Normaliza para dígitos
 * antes de validar, porque o cliente cola a chave como aparece no app da
 * SEFAZ — com espaços ou pontos.
 */
export const dceKeySchema = z
  .string()
  .transform(onlyDigits)
  .refine(isValidDceKey, {
    message: 'Chave da DC-e inválida. Confira os 44 dígitos — se o documento for uma nota fiscal, ela não serve aqui.',
  });
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `pnpm test:unit 2>&1 | grep -E "dceKeySchema|# fail"`
Esperado: os 3 testes passam.

- [ ] **Step 5: Adicionar a coluna ao schema do Prisma**

Em `prisma/schema.prisma`, no model `Shipment`, logo abaixo de `senderDocument`:

```prisma
  /// Chave de acesso da DC-e (44 dígitos). Única: a mesma declaração não pode
  /// ser reaproveitada em outro envio.
  dceKey                          String?                   @unique
```

- [ ] **Step 6: Criar e aplicar a migration**

```bash
mkdir -p prisma/migrations/20260901120000_shipment_dce_key
cat > prisma/migrations/20260901120000_shipment_dce_key/migration.sql <<'SQL'
-- Chave de acesso da DC-e, informada pelo remetente após emitir no app da SEFAZ.
ALTER TABLE "shipments" ADD COLUMN "dceKey" TEXT;
CREATE UNIQUE INDEX "shipments_dceKey_key" ON "shipments"("dceKey");
SQL

export $(grep -E '^DATABASE_URL=' .env | xargs)
psql "${DATABASE_URL%%\?*}" -f prisma/migrations/20260901120000_shipment_dce_key/migration.sql
pnpm exec prisma migrate resolve --applied 20260901120000_shipment_dce_key
pnpm exec prisma generate
```

Esperado: `ALTER TABLE`, `CREATE INDEX`, e "marked as applied".

- [ ] **Step 7: Expor o campo na criação do envio**

Em `modules/shipments/application/create-with-volumes.ts`, na interface `ShipmentInput`, logo abaixo de `senderDocument`:

```typescript
  /** Chave de acesso da DC-e, quando o documento for declaração de conteúdo. */
  dceKey?: string | null;
```

O corpo da função já faz `data: { ...input.shipment, ... }`, então o campo flui sozinho para o Prisma — nenhuma outra alteração é necessária ali.

- [ ] **Step 8: Reiniciar o servidor de dev e conferir a tipagem**

```bash
pkill -f "next-server" || true
nohup pnpm dev > dev-server.log 2>&1 &
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Esperado: nenhuma saída do `tsc`. O restart é obrigatório: sem ele o processo segue com o Prisma Client antigo e falha com "Unknown argument `dceKey`".

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260901120000_shipment_dce_key shared/validation/dce.ts tests/unit/validation/dce-checkout.test.ts modules/shipments/application/create-with-volumes.ts
git commit -m "feat(dce): coluna dceKey no envio e schema de validação

Coluna própria, não dentro do JSON do documento, porque o checkout será
barrado com base nela. Índice único impede reaproveitar a mesma DC-e em
vários envios."
```

---

### Task 3: Bloquear declaração de conteúdo sem documento do remetente

**Files:**
- Modify: `modules/cart/application/checkout.service.ts`
- Modify: `modules/shipments/application/create-paid-shipment.service.ts`
- Test: `tests/unit/validation/dce-remetente.test.ts`

**Interfaces:**
- Consumes: nada de Task 1 ou 2
- Produces: `assertSenderCanUseDeclaration(sender: { cpf: string | null; cnpj: string | null }): void` exportada de `@/shared/validation/dce`

**Contexto:** a DC-e exige CPF ou CNPJ do emitente, que aqui é o remetente. O formulário de "Minha conta" (`modules/auth/ui/components/PersonalForm.tsx`) já exige e valida o CPF — mas nada obriga o usuário a passar por essa tela antes de criar um envio. Hoje é possível criar envio com declaração de conteúdo sem documento nenhum: em homologação, 3 de 8 usuários estão nessa situação.

Esta task **não** mexe no cadastro nem cria campo novo. Ela apenas impede o caso impossível, com uma mensagem que diz onde resolver.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/validation/dce-remetente.test.ts`:

```typescript
import assert from 'node:assert';
import test from 'node:test';
import { assertSenderCanUseDeclaration } from '@/shared/validation/dce';

test.describe('validation/dce — assertSenderCanUseDeclaration', () => {
  test('passa com CPF preenchido', () => {
    assert.doesNotThrow(() => assertSenderCanUseDeclaration({ cpf: '12345678909', cnpj: null }));
  });

  test('passa com CNPJ preenchido', () => {
    assert.doesNotThrow(() => assertSenderCanUseDeclaration({ cpf: null, cnpj: '12345678000195' }));
  });

  test('falha sem documento, com código próprio', () => {
    assert.throws(
      () => assertSenderCanUseDeclaration({ cpf: null, cnpj: null }),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, 'SENDER_DOCUMENT_REQUIRED');
        assert.match(err.message, /Minha conta/);
        return true;
      }
    );
  });

  test('trata string vazia como ausente', () => {
    assert.throws(() => assertSenderCanUseDeclaration({ cpf: '', cnpj: '' }));
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar: `pnpm test:unit 2>&1 | grep -A3 "assertSenderCanUseDeclaration"`
Esperado: FAIL — a função não existe.

- [ ] **Step 3: Implementar a checagem**

Acrescentar ao final de `shared/validation/dce.ts`:

```typescript
/**
 * A DC-e exige CPF ou CNPJ do emitente — que, nos nossos envios, é o
 * remetente. Lança quando o cadastro está sem documento, apontando onde
 * resolver: o formulário de "Minha conta" já pede e valida esse campo, mas
 * nada obriga o usuário a passar por lá antes de enviar.
 */
export function assertSenderCanUseDeclaration(sender: {
  cpf: string | null;
  cnpj: string | null;
}): void {
  const temDocumento = Boolean(sender.cpf?.trim() || sender.cnpj?.trim());
  if (temDocumento) return;

  throw Object.assign(
    new Error(
      'Para enviar com declaração de conteúdo é preciso informar seu CPF ou CNPJ em Minha conta.'
    ),
    { code: 'SENDER_DOCUMENT_REQUIRED' }
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Rodar: `pnpm test:unit 2>&1 | grep -E "assertSenderCanUseDeclaration|# fail"`
Esperado: os 4 testes passam.

- [ ] **Step 5: Chamar a checagem no checkout do carrinho**

Em `modules/cart/application/checkout.service.ts`, dentro de `processCheckout`, logo após a linha que calcula `declaredValue` (procurar por `const declaredValue = calculateDeclaredValue(`):

```typescript
  // A DC-e exige documento do emitente. Barrar aqui, antes de cobrar, evita
  // criar envio que nunca poderá ter documento válido.
  if (input.document.type === 'DECLARACAO') {
    const sender = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { cpf: true, cnpj: true },
    });
    assertSenderCanUseDeclaration({ cpf: sender?.cpf ?? null, cnpj: sender?.cnpj ?? null });
  }
```

Acrescentar ao bloco de imports do arquivo:

```typescript
import { assertSenderCanUseDeclaration } from '@/shared/validation/dce';
```

- [ ] **Step 6: Chamar a checagem no envio pago avulso**

Em `modules/shipments/application/create-paid-shipment.service.ts`, logo após `const declaredValue = calculateDeclaredValue(document, insuranceValue);`:

```typescript
  if (document.type === 'DECLARACAO') {
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { cpf: true, cnpj: true },
    });
    assertSenderCanUseDeclaration({ cpf: sender?.cpf ?? null, cnpj: sender?.cnpj ?? null });
  }
```

Acrescentar ao bloco de imports do arquivo:

```typescript
import { assertSenderCanUseDeclaration } from '@/shared/validation/dce';
```

- [ ] **Step 7: Conferir tipagem e build**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
pnpm build:webpack > /tmp/build-dce.log 2>&1; echo "exit=$?"
```

Esperado: nenhum erro de tipo; `exit=0`.

- [ ] **Step 8: Conferir manualmente contra o banco**

```bash
export $(grep -E '^DATABASE_URL=' .env | xargs)
psql "${DATABASE_URL%%\?*}" -c "SELECT email, COALESCE(NULLIF(cpf,''), NULLIF(cnpj,'')) IS NOT NULL AS tem_documento FROM users;"
```

Usar um usuário sem documento para tentar um checkout com declaração de conteúdo pela tela e confirmar que a mensagem aparece apontando "Minha conta". Esse passo é do navegador — precisa da pessoa.

- [ ] **Step 9: Commit**

```bash
git add shared/validation/dce.ts tests/unit/validation/dce-remetente.test.ts modules/cart/application/checkout.service.ts modules/shipments/application/create-paid-shipment.service.ts
git commit -m "feat(dce): exigir documento do remetente na declaração de conteúdo

A DC-e exige CPF ou CNPJ do emitente. O formulário de Minha conta já pede
esse dado, mas nada obriga a passar por lá antes de enviar — em homologação,
3 de 8 usuários estavam sem. Barrar antes de cobrar evita criar envio que
nunca poderia ter documento válido."
```

---

## Fora do escopo deste plano

O bloco de emissão no checkout — a tela que orienta o cliente a emitir no app da SEFAZ e recebe a chave — **fica de fora de propósito**. Ele depende da resposta das transportadoras sobre quem emite a DC-e hoje. Se elas emitirem, esse trabalho é desnecessário; as três tasks acima valem em qualquer cenário.

Quando essa resposta chegar, o próximo plano cobre: o bloco de emissão em `FinalizarClient`, a trava do botão "Pagar agora" (lembrando de mexer em `preconditionsOk` **e** no schema do formulário, sob pena de repetir o bug do botão travado sem campo em vermelho), a exibição da chave no detalhe e no rastreio, e a retirada do PDF de declaração — inclusive o trecho de `workers/pdf/handlers/label.handler.ts` que anexa esse PDF à etiqueta dos Correios.
