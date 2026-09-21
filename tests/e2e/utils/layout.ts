import { expect, type Locator, type Page } from "@playwright/test";

export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth > 1;
  });
}

export function getSidebarLocator(page: Page): Locator {
  return page.locator('[data-testid="sidebar"]');
}

export function getHamburgerButton(page: Page): Locator {
  return page.locator('[data-testid="mobile-menu-button"]');
}

/**
  * Verifica se há pelo menos dois itens na mesma linha (útil para grids/cards em desktop).
  * Limita a análise aos primeiros elementos para manter o teste rápido.
  */
export async function expectTwoItemsInSameRow(cards: Locator, maxSample = 6) {
  // Mede de novo até o layout assentar: com os dados ainda carregando, os
  // cartões mudam de posição e uma foto única dava falso negativo.
  await expect
    .poll(async () => {
      const count = await cards.count();
      if (count < 2) return true;

      const sampleSize = Math.min(count, maxSample);
      const boxes = await Promise.all(
        Array.from({ length: sampleSize }).map((_, idx) => cards.nth(idx).boundingBox()),
      );

      const validBoxes = boxes.filter((b): b is NonNullable<typeof b> => Boolean(b));
      const tolerance = 8;
      const rows = new Map<number, number>();

      for (const box of validBoxes) {
        const key = Math.round(box.y / tolerance);
        rows.set(key, (rows.get(key) ?? 0) + 1);
      }

      return Array.from(rows.values()).some((value) => value >= 2);
    }, { message: "Esperado pelo menos dois cartões/itens na mesma linha", timeout: 10_000 })
    .toBe(true);
}
