import type { MercadoPagoPaymentResponse, ProcessedPaymentData } from '@/lib/mercadopago/types';

export function mockMercadoPagoPayment(overrides: Partial<MercadoPagoPaymentResponse> = {}): MercadoPagoPaymentResponse {
  return {
    id: overrides.id ?? 'mp-pay-1',
    status: overrides.status ?? 'approved',
    status_detail: overrides.status_detail ?? 'accredited',
    payment_type_id: overrides.payment_type_id ?? 'credit_card',
    transaction_amount: overrides.transaction_amount ?? 100,
    net_received_amount: overrides.net_received_amount ?? 95,
    fee_details: overrides.fee_details ?? [{ amount: 5, type: 'fee' }],
    card: overrides.card ?? { first_six_digits: '411111', last_four_digits: '1111', cardholder: { name: 'Test' }, brand: 'visa' },
    payer: overrides.payer ?? { id: 'payer-1' },
    date_created: overrides.date_created ?? new Date().toISOString(),
    date_last_updated: overrides.date_last_updated ?? new Date().toISOString(),
    payment_method: overrides.payment_method,
    point_of_interaction: overrides.point_of_interaction,
    charges_details: overrides.charges_details,
    metadata: overrides.metadata ?? {},
    transaction_details: overrides.transaction_details ?? { total_paid_amount: 100, net_received_amount: 95 },
    additional_info: overrides.additional_info,
    money_release_date: overrides.money_release_date,
    merchant_account_id: overrides.merchant_account_id,
    currency_id: overrides.currency_id ?? 'BRL',
    collector_id: overrides.collector_id,
    coupon_amount: overrides.coupon_amount,
    date_of_expiration: overrides.date_of_expiration,
    description: overrides.description,
    installments: overrides.installments,
    issuer_id: overrides.issuer_id,
    live_mode: overrides.live_mode,
    order: overrides.order,
    payment_method_id: overrides.payment_method_id,
    payment_type: overrides.payment_type,
    statement_descriptor: overrides.statement_descriptor,
    taxes_amount: overrides.taxes_amount,
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
    pixQrCode: overrides.pixQrCode ?? null,
    pixKey: overrides.pixKey ?? null,
    boletoUrl: overrides.boletoUrl ?? null,
    boletoBarcode: overrides.boletoBarcode ?? null,
    authorizedAt: overrides.authorizedAt ?? new Date(),
    paidAt: overrides.paidAt ?? new Date(),
  };
}
