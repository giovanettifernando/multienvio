import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canReleaseService } from '@/platform/integrations/asaas/release';

describe('canReleaseService', () => {
  it('libera quando o cartão foi aprovado', () => {
    assert.equal(canReleaseService('CAPTURED'), true);
  });

  it('libera quando o pagamento foi recebido', () => {
    assert.equal(canReleaseService('PAID'), true);
  });

  it('NÃO libera enquanto o pagamento está pendente', () => {
    assert.equal(canReleaseService('PENDING'), false);
  });

  it('NÃO libera em falha, cancelamento, estorno ou contestação', () => {
    for (const status of ['FAILED', 'CANCELED', 'REFUNDED', 'CHARGEBACK'] as const) {
      assert.equal(canReleaseService(status), false, status);
    }
  });
});
