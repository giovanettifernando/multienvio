export type WalletTxType = 'TOPUP' | 'PURCHASE' | 'REFUND' | 'WITHDRAW' | 'ADJUSTMENT';
export type WalletTxStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELED';

export type WalletTx = {
  id: string;
  type: WalletTxType;
  status: WalletTxStatus;
  amountCents: number;
  amountReais: number;
  title: string | null;
  referenceId: string | null;
  createdAt: string; // ISO date
  confirmedAt: string | null; // ISO date
};

export type Wallet = {
  available: number; // Saldo disponível em reais
  pending: number; // Saldo pendente em reais
  availableCents: number; // Saldo disponível em centavos
  pendingCents: number; // Saldo pendente em centavos
};

export type WalletTransactionsResponse = {
  transactions: WalletTx[];
  hasMore: boolean;
  cursor: string | null;
};
