import { test, expect } from "@playwright/test";
import { loginAsRemetente } from "../utils/auth";
import {
  expectTwoItemsInSameRow,
  getHamburgerButton,
  getSidebarLocator,
  hasHorizontalScroll,
} from "../utils/layout";

type RouteCase = {
  path: string;
  heading: string | RegExp;
  checkCards?: boolean;
  cardSelector?: string;
};

const routes: RouteCase[] = [
  { path: "/", heading: /Painel de Controle/i, checkCards: true, cardSelector: ".ant-card" },
  { path: "/shipments", heading: /Meus Envios/i },
  { path: "/cotacoes", heading: /^Cotar$/ },
  // sem cotação escolhida, finalizar volta para a tela de cotar
  { path: "/cotacoes/finalizar", heading: /^Cotar$/ },
  { path: "/carrinho", heading: /^Carrinho$/ },
  { path: "/etiquetas", heading: /Etiquetas/i },
  { path: "/carteira", heading: /Carteira/i, checkCards: true, cardSelector: ".ant-card" },
  { path: "/carteira/extrato", heading: /Extrato da Carteira/i },
  { path: "/carteira/faturas", heading: /Faturas e recibos/i },
  { path: "/suporte", heading: /Central de Suporte/i },
  { path: "/rastreamento", heading: /Rastreamento/i },
  { path: "/minha-conta", heading: /Minha Conta/i },
];

test.describe("Responsividade - remetente", () => {
  for (const route of routes) {
    test(`@responsive ${route.path} mantém layout sem overflow`, async ({ page }, testInfo) => {
      const isMobile = testInfo.project.name.includes("mobile");

      await loginAsRemetente(page);
      await page.goto(route.path);

      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible({
        timeout: 20_000,
      });

      const sidebar = getSidebarLocator(page);
      const burger = getHamburgerButton(page);

      if (isMobile) {
        await expect(burger).toBeVisible();
        if (await sidebar.count()) {
          await expect(sidebar).not.toBeVisible();
        }
      } else {
        await expect(sidebar).toBeVisible();
        if (await burger.count()) {
          await expect(burger).not.toBeVisible();
        }
      }

      expect(await hasHorizontalScroll(page), "Não deve haver scroll horizontal").toBeFalsy();

      if (!isMobile && route.checkCards) {
        const cards = page.locator(route.cardSelector ?? ".ant-card");
        await expectTwoItemsInSameRow(cards);
      }
    });
  }
});
