import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Sessão do remetente reaproveitada por todos os testes (ver loginAsRemetente). */
export const REMETENTE_STATE = path.join(__dirname, ".auth", "remetente.json");

/**
 * Faz o login do remetente uma vez só. Logar em cada teste estoura o limite de
 * tentativas de login (sem TRUST_PROXY todas caem no mesmo balde global).
 */
export default async function globalSetup(config: FullConfig) {
  const email = process.env.TEST_REMETENTE_EMAIL;
  const password = process.env.TEST_REMETENTE_PASSWORD;
  if (!email || !password) {
    fs.rmSync(REMETENTE_STATE, { force: true });
    return;
  }

  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();

  // Sessão da rodada anterior ainda vale? Reaproveita e poupa o limite de login.
  if (fs.existsSync(REMETENTE_STATE)) {
    const ctx = await browser.newContext({ baseURL, storageState: REMETENTE_STATE });
    const me = await ctx.request.get("/api/auth/me");
    const body = me.ok() ? await me.json().catch(() => null) : null;
    await ctx.close();
    if (body?.data?.user?.email === email || body?.user?.email === email) {
      await browser.close();
      return;
    }
    fs.rmSync(REMETENTE_STATE, { force: true });
  }

  const page = await browser.newPage({ baseURL });

  await page.goto("/auth/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });

  fs.mkdirSync(path.dirname(REMETENTE_STATE), { recursive: true });
  await page.context().storageState({ path: REMETENTE_STATE });
  await browser.close();
}
