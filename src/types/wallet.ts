export type WalletTx = {
  id: string;
  date: string; // ISO
  type: "TOPUP_CARD" | "TOPUP_PIX" | "DEBIT_LABEL" | "ADJUSTMENT";
  origin: string;
  amount: number;
  balanceAfter: number;
  description?: string;
};

export type Wallet = {
  balance: number;
  currency: "BRL";
  transactions: WalletTx[];
};
