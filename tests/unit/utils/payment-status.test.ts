import assert from 'node:assert';
import test from 'node:test';
import {
  REFUNDABLE_TRANSACTION_STATUSES,
  isRefundableTransactionStatus,
} from '@/shared/utils/payment-status';
import type { TransactionStatus } from '@prisma/client';

test.describe('utils/payment-status', () => {
  test('CAPTURED é estornável (cartão aprovado no Asaas, sem esperar liquidação)', () => {
    assert.strictEqual(isRefundableTransactionStatus('CAPTURED'), true);
  });

  test('PAID é estornável (cobrança liquidada)', () => {
    assert.strictEqual(isRefundableTransactionStatus('PAID'), true);
  });

  test('PENDING não é estornável', () => {
    assert.strictEqual(isRefundableTransactionStatus('PENDING'), false);
  });

  test('AUTHORIZED não é estornável (mapAsaasStatus nunca produz esse status)', () => {
    assert.strictEqual(isRefundableTransactionStatus('AUTHORIZED'), false);
  });

  test('CANCELED, FAILED, REFUNDED e CHARGEBACK não são estornáveis', () => {
    const nonRefundable: TransactionStatus[] = ['CANCELED', 'FAILED', 'REFUNDED', 'CHARGEBACK'];
    for (const status of nonRefundable) {
      assert.strictEqual(isRefundableTransactionStatus(status), false, `${status} não deveria ser estornável`);
    }
  });

  test('somente CAPTURED e PAID compõem o conjunto estornável', () => {
    assert.deepStrictEqual([...REFUNDABLE_TRANSACTION_STATUSES].sort(), ['CAPTURED', 'PAID']);
  });
});
