import type { MercadoPagoPaymentResponse, ProcessedPaymentData } from '@/lib/mercadopago/types';

export function mockMercadoPagoPayment(overrides: Partial<MercadoPagoPaymentResponse> = {}): MercadoPagoPaymentResponse {
  return {
    id: overrides.id ?? 1,
    status: overrides.status ?? 'approved',
    status_detail: overrides.status_detail ?? 'accredited',
    payment_type_id: overrides.payment_type_id ?? 'credit_card',
    payment_method_id: overrides.payment_method_id ?? 'visa',
    transaction_amount: overrides.transaction_amount ?? 100,
    fee_details: overrides.fee_details ?? [{ amount: 5, type: 'fee' }],
    date_created: overrides.date_created ?? new Date().toISOString(),
    installments: overrides.installments ?? 1,
    point_of_interaction: overrides.point_of_interaction ?? { type: 'PIX' },
    transaction_details: overrides.transaction_details ?? { total_paid_amount: 100, net_received_amount: 95 },
    external_reference: overrides.external_reference,
  };
}

export function mockProcessedPaymentData(overrides: Partial<ProcessedPaymentData> = {}): ProcessedPaymentData {
  return {
    externalId: overrides.externalId ?? 'ext-1',
    status: overrides.status ?? 'PAID',
    amountCents: overrides.amountCents ?? 10_000,
    feeCents: overrides.feeCents ?? 500,
    netCents: overrides.netCents ?? 9500,
    method: overrides.method ?? 'CREDIT_CARD',
    cardBrand: overrides.cardBrand ?? 'visa',
    cardLast4: overrides.cardLast4 ?? '1111',
    pixQrCode: overrides.pixQrCode,
    pixKey: overrides.pixKey,
    boletoUrl: overrides.boletoUrl,
    boletoBarcode: overrides.boletoBarcode,
    authorizedAt: overrides.authorizedAt ?? new Date(),
    paidAt: overrides.paidAt ?? new Date(),
  };
}
