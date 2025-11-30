import type { Cart } from '@/types/cart';

export interface CheckoutCartModalProps {
  open: boolean;
  onClose: () => void;
  cart: Cart;
}

export interface WalletData {
  balance: {
    availableReais: number;
    availableCents: number;
    pendingReais: number;
    pendingCents: number;
  };
  monthlySummary?: unknown;
  latestTransactions?: unknown[];
}

export type PaymentMethod = 'wallet' | 'pix' | 'card';

export interface MercadoPagoPaymentResult {
  success: boolean;
  transaction: {
    id: string;
    referenceId: string;
    status: string;
    amountCents: number;
    method: string;
  };
  payment: {
    id: number;
    status: string;
    statusDetail: string;
    pixQrCode?: string;
    pixQrCodeBase64?: string;
  };
}

export type PixPaymentStatus = 'pending' | 'paid' | 'expired' | 'error';

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
