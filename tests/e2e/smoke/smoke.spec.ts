import { test, expect } from '@playwright/test';

test('abre a página inicial do Envio Legal', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/Envio Legal/i);
});
