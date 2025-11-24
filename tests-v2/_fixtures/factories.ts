import { randomUUID } from 'crypto';
import type { TransactionStatus, WalletTxStatus, WalletTxType, QuoteStatus } from '@prisma/client';

export function fakeUser(overrides: Partial<{ id: string; email: string; role: string }> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? `user-${Math.random().toString(16).slice(2)}@test.com`,
    role: overrides.role ?? 'user',
    tokenVersion: 0,
  };
}

export function fakePaymentTransaction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    gatewayId: overrides.gatewayId ?? randomUUID(),
    referenceId: overrides.referenceId ?? `ref_${Math.random().toString(16).slice(2)}`,
    externalId: overrides.externalId ?? null,
    userId: overrides.userId as string | undefined,
    method: overrides.method ?? 'PIX',
    status: (overrides.status as TransactionStatus) ?? 'PENDING',
    amountCents: overrides.amountCents ?? 1000,
    feeCents: overrides.feeCents ?? 0,
    netCents: overrides.netCents ?? 1000,
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function fakeWallet(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    availableCents: overrides.availableCents ?? 10_000,
    pendingCents: overrides.pendingCents ?? 0,
  };
}

export function fakeWalletTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    walletId: overrides.walletId ?? randomUUID(),
    type: (overrides.type as WalletTxType) ?? 'TOPUP',
    status: (overrides.status as WalletTxStatus) ?? 'CONFIRMED',
    amountCents: overrides.amountCents ?? 1000,
    title: overrides.title ?? 'Test Tx',
    referenceId: overrides.referenceId ?? null,
    meta: overrides.meta ?? {},
    createdAt: overrides.createdAt ?? new Date(),
    confirmedAt: overrides.confirmedAt ?? new Date(),
  };
}

export function fakeQuote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    status: (overrides.status as QuoteStatus) ?? 'DRAFT',
    originCep: overrides.originCep ?? '01001000',
    destCep: overrides.destCep ?? '22290040',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    selectedAt: overrides.selectedAt ?? null,
    options: overrides.options ?? [],
    volumes: overrides.volumes ?? [],
  };
}

export function fakeCart(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    status: (overrides.status as string) ?? 'OPEN',
    totals: overrides.totals ?? { total: 0, moeda: 'BRL' },
    meta: overrides.meta ?? {},
    items: overrides.items ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function fakeShipment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    senderId: overrides.senderId ?? randomUUID(),
    platformTrackingCode: overrides.platformTrackingCode ?? `BR${Date.now()}`,
    status: (overrides.status as string) ?? 'awaiting_drop_off_at_point',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    paymentMethod: overrides.paymentMethod ?? null,
    document: overrides.document ?? {},
    packages: overrides.packages ?? [],
    label: overrides.label ?? null,
    pickupRequest: overrides.pickupRequest ?? null,
  };
}
