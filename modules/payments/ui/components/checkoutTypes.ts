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

export type PaymentMethod = 'wallet' | 'pix' | 'card' | 'boleto';

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
    status: string;
    statusDetail: string;
    pixQrCode?: string;
    /** Imagem do QR Code já em data URI (data:image/png;base64,...), retornada pelo Asaas. */
    pixQrCodeImage?: string;
  };
}

export type PixPaymentStatus = 'pending' | 'paid' | 'expired' | 'error';

// Re-export formatCurrency as alias for formatBRL for backward compatibility
export { formatCurrency };
