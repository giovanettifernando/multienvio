import { test, expect, type Page } from "@playwright/test";
import { loginAsRemetente, salvarSessaoRemetente } from "../utils/auth";

/**
 * Tela de cotação com as listas do usuário simuladas (endereços,
 * destinatários, embalagens). As respostas seguem o envelope da API: { data }.
 */

const NOW_ISO = new Date().toISOString();

type Endereco = Record<string, unknown>;
type Destinatario = Record<string, unknown>;

const matriz: Endereco = {
  id: "addr-1",
  label: "Matriz",
  cep: "01310100",
  logradouro: "Av. Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
  isDefault: true,
};

const filial: Endereco = {
  id: "addr-2",
  label: "Filial",
  cep: "80010000",
  logradouro: "Rua das Flores",
  numero: "200",
  bairro: "Centro",
  cidade: "Curitiba",
  uf: "PR",
  isDefault: false,
};

function destinatario(id: string, name: string, cidade: string, uf: string, cep: string): Destinatario {
  return {
    id,
    name,
    email: null,
    document: null,
    phone: null,
    notes: null,
    isDefault: false,
    cep,
    logradouro: "Rua A",
    numero: "1",
    complemento: null,
    bairro: "Centro",
    cidade,
    uf,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

const alice = destinatario("rec-1", "Alice Souza", "São Paulo", "SP", "04094050");
const bruno = destinatario("rec-2", "Bruno Lima", "Rio de Janeiro", "RJ", "20040002");

type Cenario = {
  addresses?: Endereco[];
  recipients?: Destinatario[];
};

const envelope = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data, error: null, meta: {} }),
});

async function abrirCotacao(page: Page, { addresses = [matriz], recipients = [alice] }: Cenario = {}) {
  await loginAsRemetente(page);

  await page.route("**/api/account/addresses", (route) =>
    route.request().method() === "GET" ? route.fulfill(envelope({ addresses })) : route.continue(),
  );
  await page.route(/\/api\/account\/recipients(\?.*)?$/, (route) =>
    route.fulfill(
      envelope({ items: recipients, page: 1, pageSize: 1000, total: recipients.length, totalPages: 1 }),
    ),
  );
  await page.route("**/api/packaging", (route) => route.fulfill(envelope([])));

  await page.goto("/cotacoes");
  await expect(page.getByRole("heading", { name: /^Cotar$/ })).toBeVisible();
  await expect(page.locator(".ant-skeleton")).toHaveCount(0);
}

/** O antd 6 põe o rótulo no invólucro e no campo; o clique vai no invólucro. */
async function abrirSelect(page: Page, rotulo: string) {
  await page.getByLabel(rotulo, { exact: true }).first().click();
}

/** Valor escolhido que o Select mostra (fora da lista de opções). */
function valorDoSelect(page: Page, rotulo: string) {
  return page.getByLabel(rotulo, { exact: true }).first().locator("[title]").first();
}

test.afterEach(async ({ page }) => salvarSessaoRemetente(page));

test.describe("Cotações - origem", () => {
  test("COT-001: já abre com o endereço padrão como remetente", async ({ page }) => {
    await abrirCotacao(page, { addresses: [filial, matriz] });
    await expect(page.getByText(/Matriz/).first()).toBeVisible();
  });

  test("COT-002: troca o endereço de remetente", async ({ page }) => {
    await abrirCotacao(page, { addresses: [matriz, filial] });

    await abrirSelect(page, "Selecionar endereço de remetente");
    await page.getByRole("option", { name: /Filial/ }).click();

    await expect(valorDoSelect(page, "Selecionar endereço de remetente")).toHaveAttribute(
      "title",
      "Filial - Rua das Flores, 200 - Centro - Curitiba/PR",
    );
  });

  test("COT-003: sem endereço cadastrado, oferece o cadastro", async ({ page }) => {
    await abrirCotacao(page, { addresses: [] });
    await expect(page.getByText("Nenhum endereço cadastrado")).toBeVisible();
    await expect(page.getByRole("button", { name: /Cadastrar endereço/ })).toBeVisible();
  });
});

test.describe("Cotações - destino", () => {
  test("COT-004: escolhe um destinatário recorrente", async ({ page }) => {
    await abrirCotacao(page, { recipients: [alice, bruno] });

    await abrirSelect(page, "Selecionar destinatário");
    await page.getByRole("option", { name: /Bruno Lima.*Rio de Janeiro\/RJ/ }).click();

    await expect(valorDoSelect(page, "Selecionar destinatário")).toHaveAttribute(
      "title",
      "Bruno Lima - Rio de Janeiro/RJ",
    );
  });

  test("COT-005: sem destinatário cadastrado, oferece o cadastro", async ({ page }) => {
    await abrirCotacao(page, { recipients: [] });

    await expect(page.getByText("Nenhum destinatário cadastrado")).toBeVisible();
    await page.getByRole("button", { name: /Cadastrar destinatário/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("COT-006: CEP digitado é consultado e formatado", async ({ page }) => {
    await page.route("**/api/cep/04101300", (route) =>
      route.fulfill(
        envelope({
          cep: "04101-300",
          logradouro: "Rua Vergueiro",
          complemento: "",
          bairro: "Vila Mariana",
          cidade: "São Paulo",
          uf: "SP",
          source: "correios",
        }),
      ),
    );
    await abrirCotacao(page);

    await page.getByRole("radio", { name: /Informar manualmente/ }).click();
    const cep = page.getByLabel("CEP de destino");
    await cep.fill("04101300");
    await cep.blur();

    await expect(cep).toHaveValue("04101-300");
    await expect(page.getByText(/São Paulo\s*\/\s*SP/).first()).toBeVisible();
  });

  test("COT-007: logística reversa inverte quem envia", async ({ page }) => {
    await abrirCotacao(page);

    await page.getByRole("radio", { name: /Informar manualmente/ }).click();
    await expect(page.getByLabel("CEP de destino")).toBeVisible();

    await page.getByText("Logística Reversa", { exact: true }).first().click();

    // Na reversa quem digita o CEP é o cliente que devolve (remetente).
    await expect(page.getByLabel("CEP do remetente")).toBeVisible();
    await expect(page.getByLabel("CEP de destino")).toHaveCount(0);
  });
});
