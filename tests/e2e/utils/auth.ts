import fs from "node:fs";
import { expect, type Page } from "@playwright/test";
import { REMETENTE_STATE } from "../global-setup";

type LoginOptions = {
  /** Forçar uso de mocks mesmo se variáveis estiverem presentes */
  useMocks?: boolean;
};

/**
 * Efetua login como remetente para cenários de E2E.
 * - Usa TEST_REMETENTE_EMAIL/TEST_REMETENTE_PASSWORD quando disponíveis.
 * - Se ausentes, injeta um usuário fake na store + mocks de API para permitir validar layout.
 */
export async function loginAsRemetente(page: Page, options?: LoginOptions) {
  const email = process.env.TEST_REMETENTE_EMAIL;
  const password = process.env.TEST_REMETENTE_PASSWORD;
  const shouldMock = options?.useMocks ?? (!email || !password);

  if (shouldMock) {
    const user = {
      id: "pw-user",
      name: "Playwright Remetente",
      email: email ?? "playwright@example.com",
      status: "active",
      roles: [],
    };

    // Persistir store de auth no localStorage (compatível com loginAsDefaultUser)
    const storageValue = JSON.stringify({
      state: {
        user,
        hasCompany: true,
      },
      version: 3,
    });

    await page.addInitScript(
      ({ value }) => {
        window.localStorage.setItem("envio-legal-auth", value);
      },
      { value: storageValue },
    );

    // Mocks básicos para evitar falhas de dados durante validação de layout
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user }),
      }),
    );

    await page.route("**/api/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      const emptyPagination = { page: 1, pageSize: 20, total: 0 };

      if (pathname.includes("/auth/me")) {
        return;
      }

      let body: unknown = {};

      if (pathname.includes("/shipments")) {
        body = { items: [], pagination: emptyPagination };
      } else if (pathname.includes("/carteira") || pathname.includes("/wallet")) {
        body = {
          balance: 0,
          summary: {},
          transactions: [],
          invoices: [],
          pagination: emptyPagination,
        };
      } else if (pathname.includes("/coletas")) {
        body = { items: [], pagination: emptyPagination };
      } else if (pathname.includes("/labels") || pathname.includes("/etiquetas")) {
        body = { items: [], pagination: emptyPagination };
      } else if (pathname.includes("/support") || pathname.includes("/suporte")) {
        body = { items: [], tickets: [], pagination: emptyPagination };
      } else if (pathname.includes("/account/company")) {
        body = { company: null };
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/($|dashboard)/);
    return user;
  }

  // Sessão criada pelo global-setup: só carregar os cookies no contexto.
  if (fs.existsSync(REMETENTE_STATE)) {
    const { cookies } = JSON.parse(fs.readFileSync(REMETENTE_STATE, "utf8"));
    await page.context().addCookies(cookies);
    return { email, name: email };
  }

  await page.goto("/auth/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email!);
  await page.getByLabel("Senha", { exact: true }).fill(password!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 20_000,
  });

  return { email, name: email };
}

/**
 * Grava de volta a sessão atual do remetente. O app renova o token 2s depois de
 * carregar a página e cada renovação invalida a anterior; sem isso o próximo
 * teste herdaria cookies já revogados. Usar em `test.afterEach`.
 */
export async function salvarSessaoRemetente(page: Page) {
  if (!fs.existsSync(REMETENTE_STATE)) return;
  await page.context().storageState({ path: REMETENTE_STATE });
}
