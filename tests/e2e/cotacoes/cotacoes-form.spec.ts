import { test, expect, type Page } from "@playwright/test";
import { loginAsDefaultUser } from "../../helpers/auth";

type MockRecipient = {
  id: string;
  name: string;
  email: string | null;
  document: string | null;
  phone: string | null;
  notes: string | null;
  isDefault: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  createdAt: string;
  updatedAt: string;
};

type MockOptions = {
  company?: Record<string, unknown> | null;
  companyDelayMs?: number;
  addresses?: Array<Record<string, unknown>>;
  recipients?: {
    items: MockRecipient[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  packaging?: Array<Record<string, unknown>>;
  currentUser?: Record<string, unknown>;
};

const NOW_ISO = new Date().toISOString();

const defaultCompany = {
  tipoPessoa: "PJ",
  empresa: {
    razao: "Envio Legal LTDA",
    fantasia: "Envio Legal",
    cnpj: "12345678000100",
    regime: "SIMPLES",
  },
  endereco: {
    cep: "01310-100",
    logradouro: "Av. Paulista",
    numero: "1000",
    complemento: "10º andar",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    telefone: "11999999999",
  },
  preferencias: {
    remetente: "Envio Legal",
    emailNotificacoes: "contato@enviolegal.com",
    dimPadrao: {},
    aceite: true,
  },
};

const singleAddress = [
  {
    id: "addr-1",
    label: "Matriz",
    cep: "01310100",
    logradouro: "Av. Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    isDefault: true,
  },
];

const defaultRecipientsList = {
  items: [
    {
      id: "rec-1",
      name: "Alice Souza",
      email: "alice@example.com",
      document: "12345678901",
      phone: "11987654321",
      notes: null,
      isDefault: false,
      cep: "04094050",
      logradouro: "Rua das Laranjeiras",
      numero: "500",
      complemento: null,
      bairro: "Saúde",
      cidade: "São Paulo",
      uf: "SP",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    } satisfies MockRecipient,
  ],
  page: 1,
  pageSize: 1,
  total: 1,
  totalPages: 1,
};

const defaultPackaging = [
  {
    id: "pkg-1",
    name: "Caixa Padrão",
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  },
];

async function mockCotacoesApis(page: Page, options: MockOptions = {}) {
  const {
    company = defaultCompany,
    companyDelayMs = 0,
    addresses = singleAddress,
    recipients = defaultRecipientsList,
    packaging = defaultPackaging,
    currentUser,
  } = options;

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: currentUser ?? null }),
    }),
  );

  await page.route("**/api/account/company", async (route) => {
    if (companyDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, companyDelayMs));
    }
    const body =
      company === null
        ? { company: null }
        : { company };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/account/addresses", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ addresses }),
    }),
  );

  await page.route(/\/api\/account\/recipients.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recipients),
    }),
  );

  await page.route("**/api/packaging", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(packaging),
    }),
  );
}

async function setupCotacoesTest(page: Page, overrides?: MockOptions) {
  const user = await loginAsDefaultUser(page);
  await mockCotacoesApis(page, { ...overrides, currentUser: user });
}

test.describe("Cotacoes - Pré-carga e formulário inicial", () => {
  test("COT-001-01: remove skeleton e preenche origem padrão após carregar empresa", async ({
    page,
  }) => {
    await setupCotacoesTest(page);
    await page.goto("/cotacoes");

    await expect(page.getByRole("heading", { name: "Cotar envio" })).toBeVisible();
    await page.waitForSelector(".ant-skeleton", { state: "detached" });
    await expect(
      page.getByText("Matriz - Av. Paulista, 1000 - Bela Vista - São Paulo/SP"),
    ).toBeVisible();
  });

  test("COT-001-02: exibe empty state quando empresa está incompleta", async ({
    page,
  }) => {
    await setupCotacoesTest(page, { company: null });
    await page.goto("/cotacoes");

    await expect(page.getByText("Complete o cadastro")).toBeVisible();
    const cta = page.getByRole("button", { name: "Ir para Minha Conta" });
    await expect(cta).toBeVisible();
    await Promise.all([
      page.waitForURL("**/minha-conta"),
      cta.click(),
    ]);
  });

  test("COT-001-03: mantém skeleton visível enquanto API está lenta", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await setupCotacoesTest(page, { companyDelayMs: 2000 });
    await page.goto("/cotacoes");

    await page.waitForTimeout(500);
    await expect(page.locator(".ant-skeleton")).toBeVisible();
    await page.waitForSelector(".ant-skeleton", { state: "detached" });
    expect(consoleErrors, "Não deve registrar erros no console durante o loading").toHaveLength(0);
  });
});

test.describe("Cotacoes - Configuração de origem/destino", () => {
  test("COT-002-01: seleciona remetente alternativo e destinatário recorrente", async ({
    page,
  }) => {
    const addresses = [
      {
        id: "addr-1",
        label: "Matriz",
        cep: "01310100",
        logradouro: "Av. Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP",
        isDefault: true,
      },
      {
        id: "addr-2",
        label: "Filial",
        cep: "80010000",
        logradouro: "Rua das Flores",
        numero: "200",
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        isDefault: false,
      },
    ];

    const recipients = {
      ...defaultRecipientsList,
      items: [
        defaultRecipientsList.items[0],
        {
          id: "rec-2",
          name: "Bruno Lima",
          email: "bruno@example.com",
          document: null,
          phone: null,
          notes: null,
          isDefault: false,
          cep: "20040002",
          logradouro: "Av. Atlântica",
          numero: "50",
          complemento: null,
          bairro: "Copacabana",
          cidade: "Rio de Janeiro",
          uf: "RJ",
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
      ],
      total: 2,
      totalPages: 1,
    };

    await setupCotacoesTest(page, { addresses, recipients });
    await page.goto("/cotacoes");
    await page.waitForSelector(".ant-skeleton", { state: "detached" });

    await test.step("Selecionar novo endereço de remetente", async () => {
      const select = page.getByLabel("Selecionar endereço de remetente");
      await select.click();
      await page.getByRole("option", { name: /Filial - Rua das Flores/ }).click();
      await expect(
        page.getByText("Filial - Rua das Flores, 200 - Centro - Curitiba/PR"),
      ).toBeVisible();
    });

    await test.step("Habilitar modo destinatário recorrente e escolher contato", async () => {
      await page.getByRole("radio", { name: "Selecionar destinatário recorrente" }).click();
      const recipientSelect = page.getByLabel("Selecionar destinatário");
      await recipientSelect.click();
      await page.getByRole("option", { name: /Bruno Lima - Rio de Janeiro\/RJ/ }).click();
      await expect(page.getByText("Destinatário recorrente")).toBeVisible();
      await expect(page.getByText("Rio de Janeiro / RJ")).toBeVisible();
    });
  });

  test("COT-002-02: mostra estado vazio e modal para cadastrar destinatário", async ({
    page,
  }) => {
    const emptyRecipients = {
      items: [],
      page: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    };

    await setupCotacoesTest(page, { recipients: emptyRecipients });
    await page.goto("/cotacoes");
    await page.waitForSelector(".ant-skeleton", { state: "detached" });

    await page.getByRole("radio", { name: "Selecionar destinatário recorrente" }).click();
    await expect(page.getByText("Nenhum destinatário cadastrado")).toBeVisible();

    await page.getByRole("button", { name: "Cadastrar destinatário" }).click();
    await expect(page.getByRole("dialog", { name: "Adicionar destinatário" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("COT-002-03: valida CEP inválido digitado manualmente", async ({ page }) => {
    await setupCotacoesTest(page);
    await page.goto("/cotacoes");
    await page.waitForSelector(".ant-skeleton", { state: "detached" });

    const destinationInput = page.getByLabel("CEP de destino");
    await destinationInput.fill("123");
    await destinationInput.blur();
    await expect(page.getByText("CEP inválido.")).toBeVisible();
  });

  test("COT-002-04: alterna logística reversa e exibe alerta contextual", async ({
    page,
  }) => {
    await setupCotacoesTest(page);
    await page.goto("/cotacoes");
    await page.waitForSelector(".ant-skeleton", { state: "detached" });

    await page.getByLabel("Alternar Logística Reversa").click();
    await expect(
      page.getByText("Modo Logística Reversa ativado. O destinatário envia e a empresa recebe."),
    ).toBeVisible();
  });

  test("COT-002-05: apresenta call to action quando não há endereços cadastrados", async ({
    page,
  }) => {
    await setupCotacoesTest(page, { addresses: [] });
    await page.goto("/cotacoes");
    await page.waitForSelector(".ant-skeleton", { state: "detached" });

    await expect(page.getByText("Nenhum endereço cadastrado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cadastrar endereço" })).toBeVisible();
  });

  test("COT-002-06: consulta CEP válido na BrasilAPI e formata valor", async ({ page }) => {
    await setupCotacoesTest(page);

    await page.route("https://brasilapi.com.br/api/cep/v2/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cep: "04101-300",
          state: "SP",
          city: "São Paulo",
          neighborhood: "Vila Mariana",
          street: "Rua Vergueiro",
        }),
      }),
    );

    await page.goto("/cotacoes");
    await page.waitForSelector(".ant-skeleton", { state: "detached" });

    const destinationInput = page.getByLabel("CEP de destino");
    await destinationInput.fill("04101300");
    await destinationInput.blur();

    await expect(destinationInput).toHaveValue("04101-300");
  });
});

