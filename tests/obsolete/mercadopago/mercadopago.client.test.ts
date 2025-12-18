import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processPaymentData } from '@/lib/mercadopago/client';
import { mockMercadoPagoPayment } from '../../_mocks/mercadopago';

describe('mercadopago client - processPaymentData', () => {
  it('converte pagamento aprovado para formato interno', () => {
    const mpPayment = {
      ...mockMercadoPagoPayment({
        id: 123,
        status: 'approved',
        payment_type_id: 'credit_card',
        transaction_amount: 123.45,
        fee_details: [{ type: 'fee', amount: 3.45 }],
      transaction_details: { net_received_amount: 120 },
      point_of_interaction: {
        type: 'PIX',
        transaction_data: {
          qr_code: 'pix-code',
          qr_code_base64: 'pix-key',
          ticket_url: 'https://boleto',
        },
      },
      barcode: { content: '1234567890' },
      }),
      barcode: { content: '1234567890' },
    };
    mpPayment.date_approved = new Date('2024-01-01T00:00:00Z').toISOString();

    const result = processPaymentData(mpPayment);

    assert.strictEqual(result.externalId, '123');
    assert.strictEqual(result.status, 'PAID');
    assert.strictEqual(result.amountCents, 12345);
    assert.strictEqual(result.feeCents, 345);
    assert.strictEqual(result.netCents, 12000);
    assert.strictEqual(result.method, 'CREDIT_CARD');
    assert.strictEqual(result.pixQrCode, 'pix-code');
    assert.strictEqual(result.pixKey, 'pix-key');
    assert.strictEqual(result.boletoUrl, 'https://boleto');
    assert.strictEqual(result.boletoBarcode, '1234567890');
    assert.strictEqual(result.paidAt?.toISOString(), '2024-01-01T00:00:00.000Z');
  });

  it('mapeia métodos PIX e boleto quando dados presentes', () => {
    const pixPayment = mockMercadoPagoPayment({
      payment_type_id: 'bank_transfer',
      status: 'pending',
      transaction_amount: 10,
      fee_details: [],
      point_of_interaction: { type: 'PIX', transaction_data: { qr_code: 'qr', qr_code_base64: 'key' } },
    });
    const boletoPayment = {
      ...mockMercadoPagoPayment({
        payment_type_id: 'ticket',
        status: 'authorized',
        transaction_amount: 10,
        fee_details: [],
        date_created: new Date('2024-02-02T00:00:00Z').toISOString(),
        point_of_interaction: { type: 'TICKET', transaction_data: { ticket_url: 'https://boleto-url' } },
      }),
      barcode: { content: 'BOLETO123' },
    };

    const pixResult = processPaymentData(pixPayment);
    const boletoResult = processPaymentData(boletoPayment);

    assert.strictEqual(pixResult.method, 'PIX');
    assert.strictEqual(pixResult.status, 'PENDING');
    assert.strictEqual(boletoResult.method, 'BOLETO');
    assert.strictEqual(boletoResult.authorizedAt?.toISOString(), '2024-02-02T00:00:00.000Z');
    assert.deepStrictEqual(
      { boletoUrl: boletoResult.boletoUrl, boletoBarcode: boletoResult.boletoBarcode },
      { boletoUrl: 'https://boleto-url', boletoBarcode: 'BOLETO123' }
    );
  });
});
