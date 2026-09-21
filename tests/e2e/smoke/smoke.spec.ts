import { test, expect } from '@playwright/test';

test('abre a página inicial do Multienvio', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Multienvio/i);
});
