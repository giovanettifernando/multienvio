# DC-e — Bloco de Emissão — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o cliente informar a chave da DC-e emitida por ele antes de pagar, tirar a declaração de papel de circulação e imprimir o QR-Code junto da etiqueta.

**Architecture:** O campo da chave entra no formulário de finalização, valida com o módulo já pronto (`shared/validation/dce.ts`), viaja no payload do checkout e é gravado na coluna `dceKey`. A declaração em papel deixa de ser oferecida e de ser anexada à etiqueta, mas o código permanece comentado. No lugar dela, o PDF da etiqueta ganha o QR-Code e o código de barras da DC-e, ambos derivados só da chave.

**Tech Stack:** TypeScript, React Hook Form, Zod, Prisma, `pdf-lib` e `bwip-js` (já no projeto), testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-01-dce-declaracao-conteudo-design.md`

## Global Constraints

- A fundação já existe: `isValidDceKey`, `parseDceKey`, `dceKeySchema` e `assertSenderCanUseDeclaration` em `shared/validation/dce.ts`; coluna `Shipment.dceKey` (`String?`, `@unique`); `ShipmentInput.dceKey`.
- Testes: `node --test --require ./tests/register.js <arquivo>`. **Não use `pnpm test:unit`** — o script usa glob, que o Node 20 desta máquina não expande (o projeto pede Node 24).
- Build: `pnpm build:webpack`, nunca `pnpm build`.
- `pnpm dev` e `pnpm build` disputam a pasta `.next`; buildar derruba o servidor de dev.
- Comandos Prisma exigem `export DATABASE_URL=...` antes.
- **Validação de pagamento sempre em duas camadas** — `preconditionsOk` e schema do formulário. Divergência entre elas já causou dois bugs neste projeto: botão travado sem campo em vermelho, e cobrança capturada antes da checagem reprovar.
- **Nada de código apagado ao remover o papel** — comentar e identificar, para reativar sem reescrever.
- Mensagens ao usuário em português.

---

### Task 1: Campo da chave na finalização, travando o pagamento

**Files:**
- Modify: `shared/types/quoteFinalize.ts` (schema do documento)
- Create: `modules/quotes/ui/components/DceKeyField.tsx`
- Modify: `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`

**Interfaces:**
- Consumes: `isValidDceKey` de `@/shared/validation/dce`
- Produces: campo `document.dceKey` no formulário de finalização; componente `DceKeyField`

**Contexto:** o cliente emite a DC-e por fora (app ou emissor Web do Fisco para pessoa física; sistema fiscal próprio para pessoa jurídica) e volta com 44 dígitos. O bloco precisa dar a ele os dados prontos para copiar, porque não há como preencher nada no app da SEFAZ por ele — esse atrito é o ponto fraco assumido do plano.

- [ ] **Step 1: Adicionar o campo ao schema do formulário**

Em `shared/types/quoteFinalize.ts`, dentro do objeto `document`, logo após `volumeDeclarations`:

```typescript
      // Chave da DC-e emitida pelo cliente. Obrigatória quando o documento é
      // declaração de conteúdo — validada no superRefine abaixo, para a
      // mensagem citar o campo certo.
      dceKey: z.string().optional(),
```

- [ ] **Step 2: Exigir a chave quando o documento for declaração**

No mesmo arquivo, dentro do `superRefine` do `finalizeFormSchema` (o que já existe, logo após o objeto), acrescentar:

```typescript
    if (values.document.type === 'DECLARACAO') {
      if (!values.document.dceKey || !isValidDceKey(values.document.dceKey)) {
        ctx.addIssue({
          path: ['document', 'dceKey'],
          code: z.ZodIssueCode.custom,
          message: 'Informe a chave da DC-e (44 dígitos) para continuar.',
        });
      }
    }
```

E no topo do arquivo:

```typescript
import { isValidDceKey } from '@/shared/validation/dce';
```

- [ ] **Step 3: Criar o componente do bloco**

Criar `modules/quotes/ui/components/DceKeyField.tsx`:

```tsx
"use client";

import { Controller, useFormContext } from "react-hook-form";
import { ELCard, ELInput, ELTypography, ELButton, ELSpace } from "@/shared/ui";
import { ExportOutlined } from "@ant-design/icons";
import { isValidDceKey } from "@/shared/validation/dce";
import type { FinalizeFormValues } from "@/shared/types/quoteFinalize";

const { Text, Paragraph } = ELTypography;

/** Emissor Web do Fisco, para pessoa física. */
const EMISSOR_FISCO = "https://www.dce.receita.pr.gov.br";

/**
 * A DC-e é emitida pelo cliente, fora da plataforma: no app ou no emissor Web
 * do Fisco (pessoa física), ou no sistema fiscal próprio (pessoa jurídica, que
 * perde o acesso ao app do Fisco em 31/10/2026). Ele volta com 44 dígitos.
 *
 * Não há como preencher nada por ele — o emissor é da SEFAZ. O que dá para
 * fazer é deixar os dados à mão para copiar e validar a chave na hora, em vez
 * de deixar o erro aparecer só na cobrança.
 */
export function DceKeyField() {
  const { control } = useFormContext<FinalizeFormValues>();

  return (
    <ELCard size="small" header={{ title: "Declaração de Conteúdo eletrônica (DC-e)" }}>
      <ELSpace orientation="vertical" size={12} style={{ width: "100%" }}>
        <Paragraph style={{ fontSize: 13, marginBottom: 0 }}>
          Emita a DC-e no site da SEFAZ e cole aqui a chave de 44 dígitos. Sem
          ela não é possível concluir o envio.
        </Paragraph>

        <ELButton
          size="small"
          icon={<ExportOutlined />}
          onClick={() => window.open(EMISSOR_FISCO, "_blank", "noopener")}
        >
          Abrir emissor da SEFAZ
        </ELButton>

        <Controller
          control={control}
          name="document.dceKey"
          render={({ field, fieldState }) => {
            const valor = field.value ?? "";
            const digitos = valor.replace(/\D/g, "");
            const completa = digitos.length === 44;
            const valida = completa && isValidDceKey(digitos);

            return (
              <div>
                <ELInput
                  {...field}
                  value={valor}
                  placeholder="Chave da DC-e (44 dígitos)"
                  status={completa && !valida ? "error" : undefined}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                {completa && !valida && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    Chave inválida. Se o documento for uma nota fiscal, ela não serve aqui.
                  </Text>
                )}
                {!completa && digitos.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {digitos.length} de 44 dígitos
                  </Text>
                )}
                {valida && (
                  <Text type="success" style={{ fontSize: 12 }}>
                    Chave válida.
                  </Text>
                )}
                {fieldState.error && !completa && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {fieldState.error.message}
                  </Text>
                )}
              </div>
            );
          }}
        />
      </ELSpace>
    </ELCard>
  );
}

export default DceKeyField;
```

- [ ] **Step 4: Renderizar o bloco na finalização**

Em `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`, no bloco que hoje renderiza o `DocumentChooser`:

```tsx
            <ELGrid variant="forms" gap="xl">
              <DocumentChooser />
              {documentType === "DECLARACAO" && <DceKeyField />}
            </ELGrid>
```

E o import, junto aos demais de `@/modules/quotes/ui/components`:

```typescript
import { DceKeyField } from "@/modules/quotes/ui/components/DceKeyField";
```

- [ ] **Step 5: Travar o botão na segunda camada**

No mesmo arquivo, junto de `faltaDocumentoDoRemetente`:

```typescript
  const dceKeyInformada = useWatch({ control, name: "document.dceKey" });
  const faltaChaveDce =
    documentType === "DECLARACAO" && !isValidDceKey(dceKeyInformada ?? "");
```

Import: `import { isValidDceKey } from "@/shared/validation/dce";`

Em `preconditionsOk`, junto das outras checagens:

```typescript
    if (faltaChaveDce) return false;
```

E na lista de dependências do `useMemo`, acrescentar `faltaChaveDce`.

Em `disabledTooltip`, antes do texto genérico:

```typescript
    if (faltaChaveDce) {
      return "Informe a chave da DC-e para continuar.";
    }
```

E `faltaChaveDce` na lista de dependências desse `useMemo` também.

- [ ] **Step 6: Conferir tipagem e compilação**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
curl -s -o /dev/null -w "%{http_code}\n" --max-time 90 http://localhost:3000/cotacoes/finalizar
grep -ciE "Failed to compile|Module not found" dev-server.log
```

Esperado: sem erro de tipo, HTTP 307 (redireciona para login) e zero erros de compilação.

- [ ] **Step 7: Conferir na tela**

Passo humano. Com declaração de conteúdo escolhida: o bloco aparece, o botão "Pagar agora" fica desabilitado, e o tooltip diz para informar a chave. Colar `41260912345678000195990010000000421011234561` deve liberar. Colar uma chave de NF-e (`41260912345678000195550010000000421011234566`) deve acusar erro. Com NF-e escolhida, o bloco não aparece e nada trava.

- [ ] **Step 8: Commit**

```bash
git add shared/types/quoteFinalize.ts modules/quotes/ui/components/DceKeyField.tsx "app/(envio)/cotacoes/finalizar/FinalizarClient.tsx"
git commit -m "feat(dce): campo da chave na finalização, travando o pagamento

O cliente emite a DC-e fora da plataforma e volta com 44 dígitos. O bloco
valida enquanto ele digita e trava o pagamento nas duas camadas — botão e
schema — porque validar só numa delas já causou dois bugs aqui: botão
travado sem campo em vermelho, e cartão cobrado antes da checagem reprovar."
```

---

### Task 2: A chave chega ao servidor e é gravada

**Files:**
- Modify: `app/api/shipments/create-paid/route.ts`
- Modify: `modules/shipments/application/create-paid-shipment.service.ts`
- Modify: `modules/payments/ui/components/PaidCheckoutModal.tsx`
- Modify: `modules/cart/dto/cart.ts`
- Modify: `modules/cart/application/checkout.service.ts`

**Interfaces:**
- Consumes: `dceKeySchema` de `@/shared/validation/dce`; coluna `Shipment.dceKey`; `ShipmentInput.dceKey`
- Produces: `dceKey` gravado no envio nos dois fluxos de checkout

**Contexto:** a coluna e o campo em `ShipmentInput` já existem da fundação. Falta a chave viajar da tela até lá. O schema do servidor é a segunda camada de validação — chave que chegue por API não passa pela tela.

- [ ] **Step 1: Aceitar a chave no schema da rota**

Em `app/api/shipments/create-paid/route.ts`, no objeto Zod do payload, logo após `totalCost`:

```typescript
  /** Chave da DC-e, obrigatória quando o documento é declaração de conteúdo. */
  dceKey: dceKeySchema.optional(),
```

Import: `import { dceKeySchema } from '@/shared/validation/dce';`

- [ ] **Step 2: Repassar ao serviço**

No mesmo arquivo, onde o payload é montado para `createPaidShipment` (junto de `originCep: data.originCep`):

```typescript
      dceKey: data.dceKey ?? null,
```

- [ ] **Step 3: Exigir e gravar no serviço**

Em `modules/shipments/application/create-paid-shipment.service.ts`, na interface de entrada, junto de `freightCost`:

```typescript
  dceKey?: string | null;
```

Desestruturar junto dos demais campos, e logo após o bloco de `assertSenderCanUseDeclaration`:

```typescript
  // Última linha de defesa: a tela já trava, mas chamada por API não passa por ela.
  if (document.type === 'DECLARACAO' && !isValidDceKey(dceKey ?? '')) {
    throw Object.assign(
      new Error('Chave da DC-e ausente ou inválida.'),
      { code: 'DCE_KEY_REQUIRED' }
    );
  }
```

Import: `import { isValidDceKey } from '@/shared/validation/dce';`

E no objeto passado a `createShipmentWithVolumes`, junto de `declaredValue`:

```typescript
        dceKey: dceKey ?? null,
```

- [ ] **Step 4: Enviar a chave a partir da tela**

Em `modules/payments/ui/components/PaidCheckoutModal.tsx`, no tipo de `checkoutData` acrescentar `dceKey?: string | null;`, e no corpo do `fetch` de `createShipmentWithPayment`, junto de `document: checkoutData.document`:

```typescript
        dceKey: checkoutData.dceKey ?? null,
```

Em `FinalizarClient.tsx`, onde `paidCheckoutData` é montado, incluir:

```typescript
        dceKey: watch("document.dceKey") ?? null,
```

- [ ] **Step 5: Mesmo caminho no checkout do carrinho**

Em `modules/cart/dto/cart.ts`, no `documentSnapshotSchema`, acrescentar:

```typescript
  dceKey: z.string().optional(),
```

Em `modules/cart/application/checkout.service.ts`, no tipo `CheckoutDocument` acrescentar `dceKey?: string;`, e no objeto de `createShipmentWithVolumes`, junto de `declaredValue`:

```typescript
        dceKey: input.document.dceKey ?? null,
```

- [ ] **Step 6: Conferir tipagem e build**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
pnpm build:webpack > /tmp/build-dce2.log 2>&1; echo "exit=$?"
```

Esperado: sem erro de tipo, `exit=0`. O build derruba o servidor de dev — subir de novo com `nohup pnpm dev > dev-server.log 2>&1 < /dev/null & disown`.

- [ ] **Step 7: Conferir gravação no banco**

Passo humano: fazer um envio com declaração, colando a chave. Depois:

```bash
export $(grep -E '^DATABASE_URL=' .env | xargs)
psql "${DATABASE_URL%%\?*}" -c "SELECT \"platformTrackingCode\", \"dceKey\" FROM shipments ORDER BY \"createdAt\" DESC LIMIT 1;"
```

Esperado: a chave gravada, com 44 dígitos.

- [ ] **Step 8: Commit**

```bash
git add app/api/shipments/create-paid/route.ts modules/shipments/application/create-paid-shipment.service.ts modules/payments/ui/components/PaidCheckoutModal.tsx modules/cart/dto/cart.ts modules/cart/application/checkout.service.ts "app/(envio)/cotacoes/finalizar/FinalizarClient.tsx"
git commit -m "feat(dce): chave viaja da tela até o banco nos dois checkouts

O schema do servidor repete a validação porque chamada por API não passa
pela tela — é a última linha de defesa antes de criar envio sem documento."
```

---

### Task 3: Tirar a declaração de papel de circulação

**Files:**
- Modify: `workers/pdf/handlers/label.handler.ts:435-470`
- Modify: `app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`
- Modify: `modules/labels/infra/print-shipment-declaration.ts`

**Interfaces:**
- Consumes: nada
- Produces: nenhum PDF de declaração de papel gerado ou anexado

**Contexto:** decisão do produto é **ocultar, não apagar**. Os geradores (`shared/docs/correios/declaracao-conteudo-pdf.ts` e a parte de declaração em `modules/labels/infra/document-pdf.ts`) ficam intactos no projeto; o que muda é deixar de chamá-los. Se a DC-e precisar retroceder ou conviver com o papel em alguma praça, é descomentar.

- [ ] **Step 1: Parar de anexar o PDF à etiqueta dos Correios**

Em `workers/pdf/handlers/label.handler.ts`, envolver o bloco que começa em `if (shipmentDoc?.type === 'DECLARACAO') {` (linha ~437) e termina no fecho correspondente, com um comentário de bloco:

```typescript
  /* DESATIVADO EM 01/09/2026 — a declaração de conteúdo em papel foi
     substituída pela DC-e, que o cliente emite na SEFAZ. O que vai na
     embalagem agora é o QR-Code da DC-e, adicionado em createEnvioLegalPdf.

     Mantido comentado, e não removido, para reativar sem reescrever caso o
     papel volte a ser aceito ou precise conviver com a DC-e.

  if (shipmentDoc?.type === 'DECLARACAO') {
    ... bloco original inteiro ...
  }
  */
```

Se o TypeScript reclamar de imports não usados (`generateDeclaracaoConteudoPdf`, `DeclaracaoConteudoPayload`, `extractDeclarationItems`, `formatEndereco`), comentar também as linhas de import correspondentes, com a mesma justificativa em uma linha.

- [ ] **Step 2: Botão de impressão passa a valer só para NF-e**

Em `app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`, trocar a condição do botão de impressão:

```tsx
          {shipment && shipment.volumes.length > 0 && isNFeShipment(shipment) && (
            <Tooltip title="Gerar o PDF e abrir a impressão">
              <ELButton icon={<PrinterOutlined />} onClick={handlePrintDocument}>
                Imprimir NF-e
              </ELButton>
            </Tooltip>
          )}
```

- [ ] **Step 3: Mesma regra na listagem**

Em `app/(envio)/shipments/ShipmentsClient.tsx`, se houver botão equivalente de impressão de declaração, aplicar a mesma condição. Se não houver, seguir sem alterar.

- [ ] **Step 4: Deixar o motivo registrado no helper**

Em `modules/labels/infra/print-shipment-declaration.ts`, acrescentar ao comentário do topo do arquivo:

```typescript
 * Desde 01/09/2026 este caminho só é usado para NF-e. A declaração de conteúdo
 * em papel deixou de ser oferecida — foi substituída pela DC-e, emitida pelo
 * cliente na SEFAZ. O gerador de declaração continua em document-pdf.ts para
 * reativação futura.
```

- [ ] **Step 5: Conferir tipagem e build**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
pnpm run workers:check 2>&1 | grep -cE "error TS"
pnpm build:webpack > /tmp/build-dce3.log 2>&1; echo "exit=$?"
```

Esperado: sem erro no `tsc`; o `workers:check` deve continuar em **42** erros (dívida anterior, medida em 01/09/2026 — não deve aumentar); `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add workers/pdf/handlers/label.handler.ts "app/(envio)/shipments/[id]/ShipmentDetailClient.tsx" modules/labels/infra/print-shipment-declaration.ts
git commit -m "feat(dce): declaração em papel sai de circulação, código permanece

Deixa de ser anexada à etiqueta dos Correios e de ser oferecida na tela. O
gerador continua no projeto, comentado e identificado, para reativar sem
reescrever caso o papel volte a ser aceito."
```

---

### Task 4: QR-Code e código de barras da DC-e na etiqueta

**Files:**
- Modify: `platform/labels/pdf-generator.ts`
- Modify: `workers/pdf/handlers/label.handler.ts`
- Test: `tests/unit/validation/dce-qrcode.test.ts`

**Interfaces:**
- Consumes: `Shipment.dceKey`
- Produces:
  - `buildDceQrCodeUrl(chave: string, ambiente?: 1 | 2): string` exportada de `@/shared/validation/dce`
  - `EnvioLegalPdfOptions.dceKey?: string | null`

**Contexto:** o manual exige que o QR-Code e o código de barras da DACE estejam visíveis na embalagem. Ambos derivam só da chave — o QR é uma URL simples (Anexo II, 3.2.1), e o código de barras é a própria chave em Code128. O projeto já usa `bwip-js` em `platform/labels/pdf-generator.ts`, então não entra dependência nova.

Isto **não** é um DACE completo: falta o protocolo de autorização, que só a SEFAZ devolve a quem emitiu. É o que precisa ser lido na caixa, não uma segunda via oficial.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/validation/dce-qrcode.test.ts`:

```typescript
import assert from 'node:assert';
import test from 'node:test';
import { buildDceQrCodeUrl } from '@/shared/validation/dce';

const CHAVE = '41260912345678000195990010000000421011234561';

test.describe('validation/dce — buildDceQrCodeUrl', () => {
  test('monta a URL de consulta com a chave', () => {
    const url = buildDceQrCodeUrl(CHAVE);
    assert.match(url, /chDCe=41260912345678000195990010000000421011234561/);
    assert.match(url, /tpAmb=1/);
  });

  test('aceita ambiente de homologação', () => {
    assert.match(buildDceQrCodeUrl(CHAVE, 2), /tpAmb=2/);
  });

  test('normaliza chave com máscara', () => {
    const url = buildDceQrCodeUrl(' 4126 0912 3456 7800 0195 9900 1000 0000 4210 1123 4561 ');
    assert.match(url, /chDCe=41260912345678000195990010000000421011234561/);
  });

  test('rejeita chave inválida', () => {
    assert.throws(() => buildDceQrCodeUrl('123'));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
NODE_ENV=test node --test --require ./tests/register.js tests/unit/validation/dce-qrcode.test.ts 2>&1 | grep -E "^# fail"
```

Esperado: `# fail 4` — a função não existe.

- [ ] **Step 3: Implementar o gerador da URL**

Acrescentar ao final de `shared/validation/dce.ts`:

```typescript
/**
 * URL que vai dentro do QR-Code impresso na embalagem.
 *
 * Anexo II, seção 3.2.1: o QR-Code contém o endereço de consulta da SEFAZ
 * seguido da chave e do ambiente. Não depende do protocolo de autorização —
 * por isso a plataforma consegue imprimi-lo a partir do que o cliente colar.
 */
export function buildDceQrCodeUrl(value: string, ambiente: 1 | 2 = 1): string {
  const chave = onlyDigits(value ?? '');
  if (!isValidDceKey(chave)) {
    throw new Error('Chave da DC-e inválida para gerar o QR-Code.');
  }
  return `https://dfe-portal.svrs.rs.gov.br/dce/QrCode?chDCe=${chave}&tpAmb=${ambiente}`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
NODE_ENV=test node --test --require ./tests/register.js tests/unit/validation/dce-qrcode.test.ts 2>&1 | grep -E "^# (pass|fail)"
```

Esperado: `# pass 4`, `# fail 0`.

- [ ] **Step 5: Aceitar a chave no gerador de PDF da etiqueta**

Em `platform/labels/pdf-generator.ts`, na interface `EnvioLegalPdfOptions`:

```typescript
  /** Chave da DC-e. Quando presente, o QR-Code é impresso no cabeçalho. */
  dceKey?: string | null;
```

Desestruturar junto dos demais (`const { platformTrackingCode, correioPdfBuffers, packageNumber, dceKey } = options;`) e, depois do código de barras já existente, acrescentar:

```typescript
  // QR-Code da DC-e. O manual exige que ele esteja visível na embalagem, e ele
  // deriva só da chave — não precisa do protocolo de autorização.
  if (dceKey && isValidDceKey(dceKey)) {
    const qrPng = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: buildDceQrCodeUrl(dceKey),
      scale: 3,
      includetext: false,
    });
    const qrImage = await pdfDoc.embedPng(qrPng);
    const qrSize = 56;
    firstPage.drawImage(qrImage, {
      x: width - qrSize - 16,
      y: height - qrSize - 12,
      width: qrSize,
      height: qrSize,
    });
    firstPage.drawText('DC-e', {
      x: width - qrSize - 16,
      y: height - qrSize - 22,
      size: 6,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
```

Imports: `import { buildDceQrCodeUrl, isValidDceKey } from '@/shared/validation/dce';`

**Ajustar os nomes** `firstPage`, `width` e `height` aos que o arquivo já usa — ler o trecho do cabeçalho antes de escrever, e reaproveitar as variáveis existentes em vez de criar novas.

- [ ] **Step 6: Passar a chave ao gerar a etiqueta**

Em `workers/pdf/handlers/label.handler.ts`, na chamada de `createEnvioLegalPdf`:

```typescript
  let finalPdf: Buffer | Uint8Array = await createEnvioLegalPdf({
    platformTrackingCode,
    correioPdfBuffers: pdfBuffers,
    dceKey: label.shipment.dceKey,
  });
```

Conferir que a consulta do shipment no início do handler traz `dceKey` — se usar `select`, acrescentar o campo.

- [ ] **Step 7: Conferir tipagem e build**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
pnpm build:webpack > /tmp/build-dce4.log 2>&1; echo "exit=$?"
```

Esperado: sem erro de tipo, `exit=0`.

- [ ] **Step 8: Conferir a etiqueta gerada**

Passo humano: abrir a etiqueta de um envio com `dceKey` preenchida e confirmar que o QR-Code aparece. Ler o QR com o celular — deve abrir a consulta da SEFAZ com a chave.

- [ ] **Step 9: Commit**

```bash
git add shared/validation/dce.ts tests/unit/validation/dce-qrcode.test.ts platform/labels/pdf-generator.ts workers/pdf/handlers/label.handler.ts
git commit -m "feat(dce): QR-Code da DC-e impresso na etiqueta

O manual exige o QR visível na embalagem, e ele deriva só da chave (Anexo
II, 3.2.1) — não precisa do protocolo de autorização, que a plataforma não
tem. Não é um DACE completo: é o que a fiscalização lê na caixa."
```

---

### Task 5: Chave visível no detalhe do envio e no rastreio

**Files:**
- Modify: `app/api/shipments/[id]/route.ts`
- Modify: `app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`
- Modify: `app/api/public/track/[code]/route.ts`
- Modify: `app/rastreio/[code]/PublicTrackingClient.tsx`

**Interfaces:**
- Consumes: `Shipment.dceKey`, `parseDceKey`
- Produces: chave exibida nas duas telas

**Contexto:** as duas telas já exibem os mesmos campos desde o trabalho de agosto — a chave entra como mais um, seguindo o padrão que já existe.

- [ ] **Step 1: Expor no tipo da API de detalhe**

Em `app/api/shipments/[id]/route.ts`, no tipo da resposta, junto de `senderDocument`:

```typescript
  dceKey: string | null;
```

O retorno usa `...shipmentBase`, então o campo flui sozinho.

- [ ] **Step 2: Exibir no detalhe do envio**

Em `app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`, acrescentar `dceKey: string | null;` ao tipo `ShipmentDetail`, e um campo no cartão "Informações Gerais", depois de "Método de pagamento":

```tsx
              {shipment.dceKey && (
                <ELGridSpanFull>
                  <Text type="secondary">Chave da DC-e</Text>
                  <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                    {shipment.dceKey}
                  </div>
                </ELGridSpanFull>
              )}
```

- [ ] **Step 3: Expor na API pública**

Em `app/api/public/track/[code]/route.ts`, acrescentar `dceKey: true` ao `select` do shipment completo e, no objeto de retorno, junto de `paymentMethod`:

```typescript
      dceKey: shipment.dceKey,
```

- [ ] **Step 4: Exibir no rastreio público**

Em `app/rastreio/[code]/PublicTrackingClient.tsx`, acrescentar `dceKey: string | null;` ao tipo `TrackingData` e um campo na grade, junto dos demais:

```tsx
            {data.dceKey && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Chave da DC-e</Text>
                <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                  {data.dceKey}
                </div>
              </div>
            )}
```

- [ ] **Step 5: Conferir tipagem e as duas telas**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | head -5
export $(grep -E '^DATABASE_URL=' .env | xargs)
code=$(psql "${DATABASE_URL%%\?*}" -tAc "SELECT \"publicTrackingId\" FROM shipments WHERE \"dceKey\" IS NOT NULL ORDER BY \"createdAt\" DESC LIMIT 1;")
curl -s "http://localhost:3000/api/public/track/$code" | python3 -m json.tool | grep -i dce
```

Esperado: sem erro de tipo e a chave presente no retorno público.

- [ ] **Step 6: Commit**

```bash
git add "app/api/shipments/[id]/route.ts" "app/(envio)/shipments/[id]/ShipmentDetailClient.tsx" "app/api/public/track/[code]/route.ts" "app/rastreio/[code]/PublicTrackingClient.tsx"
git commit -m "feat(dce): chave visível no detalhe do envio e no rastreio público"
```

---

## Fora do escopo

**Cancelamento da DC-e junto com o envio.** A spec decidiu cancelar automaticamente quando possível (prazo SEFAZ: 24h), mas nesta modalidade **quem cancela é quem emitiu** — o cliente, no app da SEFAZ. A plataforma não tem certificado para assinar o evento. O que cabe aqui é avisar o cliente ao cancelar um envio com DC-e; fica para um plano próprio, com essa conversa feita antes.

**Emissão pela plataforma (modalidade marketplace).** Decidido não comprar certificado. Se mudar, o campo da chave continua e passa a ser preenchido automaticamente.

**Aviso do prazo de 31/10/2026 para pessoa jurídica.** Depois dessa data o cliente PJ não emite mais no app do Fisco e precisa usar o sistema fiscal dele. Vale um aviso na tela para esses clientes, mas depende de saber identificar quem é PJ no cadastro — decisão de produto ainda não tomada.
