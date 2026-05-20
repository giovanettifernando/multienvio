import type { Cart } from '@/shared/types/cart';
import { formatBRL as formatCurrency } from '@/shared/utils/format';

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

export interface PaymentResult {
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
    pixQrCodeUrl?: string;
  };
}

export type PixPaymentStatus = 'pending' | 'paid' | 'expired' | 'error';

// Re-export formatCurrency as alias for formatBRL for backward compatibility
export { formatCurrency };
