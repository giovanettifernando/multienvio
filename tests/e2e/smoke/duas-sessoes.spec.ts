import { test, expect, type Page } from "@playwright/test";
import { loginAsRemetente } from "../utils/auth";

/**
 * Mesmo usuário logado em dois aparelhos: renovar o token num não derruba o
 * outro, e sair num encerra só aquele aparelho.
 */

const email = process.env.TEST_REMETENTE_EMAIL;
const password = process.env.TEST_REMETENTE_PASSWORD;

/** O app renova o token 2s depois de abrir a página; esperar garante a renovação. */
async function abrirEsperandoRenovacao(page: Page, caminho: string, titulo: RegExp) {
  await page.goto(caminho);
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
  await page.waitForTimeout(3_000);
}

test("dois aparelhos ao mesmo tempo; sair em um não derruba o outro", async ({ browser }, testInfo) => {
  test.skip(!email || !password, "precisa de TEST_REMETENTE_EMAIL/PASSWORD");
  // Um login real a mais por rodada: só no desktop, para poupar o limite de login.
  test.skip(testInfo.project.name.includes("mobile"), "roda só no desktop");

  const notebook = await (await browser.newContext()).newPage();
  await loginAsRemetente(notebook);
  await abrirEsperandoRenovacao(notebook, "/carteira", /^Carteira$/);

  // Segundo aparelho: login de verdade, que abre outra sessão
  const celular = await (await browser.newContext()).newPage();
  await celular.goto("/auth/login");
  await celular.getByLabel("E-mail", { exact: true }).fill(email!);
  await celular.getByLabel("Senha", { exact: true }).fill(password!);
  await celular.getByRole("button", { name: /entrar/i }).click();
  await celular.waitForURL((url) => !url.pathname.startsWith("/auth"));
  await abrirEsperandoRenovacao(celular, "/carteira", /^Carteira$/);

  // O notebook segue logado depois do login e da renovação no celular
  await abrirEsperandoRenovacao(notebook, "/shipments", /Meus Envios/);

  // Sai no celular
  await celular.getByRole("button", { name: /Sair/ }).first().click();
  await celular.waitForURL(/\/auth\/login/);

  // O notebook continua logado; o celular não entra mais
  await abrirEsperandoRenovacao(notebook, "/carteira", /^Carteira$/);
  await celular.goto("/carteira");
  await expect(celular).toHaveURL(/\/auth\/login/);
});
