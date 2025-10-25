import type { CardMethod, Invoice, LedgerEntry, PixTopup, Wallet } from "@/types/billing";

export type BillingStore = {
  wallet: Wallet;
  ledger: LedgerEntry[];
  cards: Map<string, CardMethod>;
  pixTopups: Map<string, PixTopup>;
  invoices: Map<string, Invoice>;
};

declare global {
  var __billingStore: BillingStore | undefined;
}

export function getBillingStore(): BillingStore {
  if (!globalThis.__billingStore) {
    globalThis.__billingStore = {
      wallet: {
        id: "wal_1",
        balance: 0,
        currency: "BRL",
        updatedAt: new Date().toISOString(),
      },
      ledger: [],
      cards: new Map(),
      pixTopups: new Map(),
      invoices: new Map(),
    };
  }
  return globalThis.__billingStore;
}

export function applyLedgerEntry(entry: Omit<LedgerEntry, "balanceAfter">) {
  const store = getBillingStore();
  const currentBalance = store.wallet.balance;
  const newBalance = Number((currentBalance + entry.amount).toFixed(2));
  const persisted: LedgerEntry = {
    ...entry,
    balanceAfter: newBalance,
  };
  store.ledger = [persisted, ...store.ledger];
  store.wallet.balance = newBalance;
  store.wallet.updatedAt = entry.occurredAt;
  return persisted;
}

export function getDefaultCard(): CardMethod | undefined {
  const store = getBillingStore();
  const defaultCard = Array.from(store.cards.values()).find((card) => card.isDefault);
  if (defaultCard) {
    return defaultCard;
  }
  return store.cards.values().next().value;
}
