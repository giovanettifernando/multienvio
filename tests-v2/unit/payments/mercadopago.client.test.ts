import { describe, it, strictEqual, deepStrictEqual } from 'node:test';
import { processPaymentData } from '@/lib/mercadopago/client';
import { mockMercadoPagoPayment } from '../../_mocks/mercadopago';

describe('mercadopago client - processPaymentData', () => {
  it('converte pagamento aprovado para formato interno', () => {
    const mpPayment = mockMercadoPagoPayment({
      id: '123',
      status: 'approved',
      payment_type_id: 'credit_card',
      transaction_amount: 123.45,
      fee_details: [{ type: 'fee', amount: 3.45 }],
      transaction_details: { net_received_amount: 120 },
      point_of_interaction: {
        transaction_data: {
          qr_code: 'pix-code',
          qr_code_base64: 'pix-key',
          ticket_url: 'https://boleto',
        },
      },
      barcode: { content: '1234567890' },
      date_approved: new Date('2024-01-01T00:00:00Z').toISOString(),
    });

    const result = processPaymentData(mpPayment);

    strictEqual(result.externalId, '123');
    strictEqual(result.status, 'PAID');
    strictEqual(result.amountCents, 12345);
    strictEqual(result.feeCents, 345);
    strictEqual(result.netCents, 12000);
    strictEqual(result.method, 'CREDIT_CARD');
    strictEqual(result.pixQrCode, 'pix-code');
    strictEqual(result.pixKey, 'pix-key');
    strictEqual(result.boletoUrl, 'https://boleto');
    strictEqual(result.boletoBarcode, '1234567890');
    strictEqual(result.paidAt?.toISOString(), '2024-01-01T00:00:00.000Z');
  });

  it('mapeia métodos PIX e boleto quando dados presentes', () => {
    const pixPayment = mockMercadoPagoPayment({
      payment_type_id: 'bank_transfer',
      status: 'pending',
      transaction_amount: 10,
      fee_details: [],
    });
    const boletoPayment = mockMercadoPagoPayment({
      payment_type_id: 'ticket',
      status: 'authorized',
      transaction_amount: 10,
      fee_details: [],
      date_created: new Date('2024-02-02T00:00:00Z').toISOString(),
      barcode: { content: 'BOLETO123' },
      point_of_interaction: { transaction_data: { ticket_url: 'https://boleto-url' } },
    });

    const pixResult = processPaymentData(pixPayment);
    const boletoResult = processPaymentData(boletoPayment);

    strictEqual(pixResult.method, 'PIX');
    strictEqual(pixResult.status, 'PENDING');
    strictEqual(boletoResult.method, 'BOLETO');
    strictEqual(boletoResult.authorizedAt?.toISOString(), '2024-02-02T00:00:00.000Z');
    deepStrictEqual(
      { boletoUrl: boletoResult.boletoUrl, boletoBarcode: boletoResult.boletoBarcode },
      { boletoUrl: 'https://boleto-url', boletoBarcode: 'BOLETO123' }
    );
  });
});
