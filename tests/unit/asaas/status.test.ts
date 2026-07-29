import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAsaasStatus,
  mapBillingTypeToMethod,
  mapMethodToBillingType,
} from '@/platform/integrations/asaas/status';

describe('mapAsaasStatus', () => {
  it('mapeia CONFIRMED para CAPTURED (libera o serviço)', () => {
    assert.equal(mapAsaasStatus('CONFIRMED'), 'CAPTURED');
  });

  it('mapeia RECEIVED para PAID', () => {
    assert.equal(mapAsaasStatus('RECEIVED'), 'PAID');
    assert.equal(mapAsaasStatus('RECEIVED_IN_CASH'), 'PAID');
  });

  it('mapeia estados pendentes', () => {
    assert.equal(mapAsaasStatus('PENDING'), 'PENDING');
    assert.equal(mapAsaasStatus('AWAITING_RISK_ANALYSIS'), 'PENDING');
  });

  it('mapeia vencido e cancelado para CANCELED', () => {
    assert.equal(mapAsaasStatus('OVERDUE'), 'CANCELED');
    assert.equal(mapAsaasStatus('DELETED'), 'CANCELED');
  });

  it('mapeia estornos e contestações', () => {
    assert.equal(mapAsaasStatus('REFUNDED'), 'REFUNDED');
    assert.equal(mapAsaasStatus('REFUND_REQUESTED'), 'REFUNDED');
    assert.equal(mapAsaasStatus('CHARGEBACK_REQUESTED'), 'CHARGEBACK');
    assert.equal(mapAsaasStatus('CHARGEBACK_DISPUTE'), 'CHARGEBACK');
  });

  it('mapeia recusa de cartão para FAILED', () => {
    assert.equal(mapAsaasStatus('CREDIT_CARD_CAPTURE_REFUSED'), 'FAILED');
  });

  it('usa PENDING como padrão para status desconhecido', () => {
    assert.equal(mapAsaasStatus('ALGO_NOVO_NA_API'), 'PENDING');
  });
});

describe('mapeamento de meio de pagamento', () => {
  it('converte billingType do Asaas para o enum interno', () => {
    assert.equal(mapBillingTypeToMethod('PIX'), 'PIX');
    assert.equal(mapBillingTypeToMethod('CREDIT_CARD'), 'CREDIT_CARD');
    assert.equal(mapBillingTypeToMethod('BOLETO'), 'BOLETO');
    assert.equal(mapBillingTypeToMethod('DEBIT_CARD'), 'DEBIT_CARD');
  });

  it('converte o método da nossa API para billingType do Asaas', () => {
    assert.equal(mapMethodToBillingType('pix'), 'PIX');
    assert.equal(mapMethodToBillingType('credit_card'), 'CREDIT_CARD');
    assert.equal(mapMethodToBillingType('boleto'), 'BOLETO');
  });
});
