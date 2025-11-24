import { test } from '@playwright/test';

test.describe.skip('E2E pagamentos', () => {
  test('recarga via Pix ou cartão credita carteira (placeholder)', async () => {
    // TODO: implementar fluxo real usando fixtures e servidor em execução.
  });

  test('checkout do carrinho pago via MP emite etiquetas (placeholder)', async () => {
    // TODO: implementar fluxo real.
  });
});
