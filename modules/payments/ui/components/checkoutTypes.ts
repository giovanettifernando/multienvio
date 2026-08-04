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

/**
 * Mesmos quatro estados de `PixPaymentStatus`, mas usados também para o
 * acompanhamento de boleto (Task 15) — o nome "Pix..." ficou datado depois
 * que `usePixPayment` passou a rastrear qualquer pagamento pendente (pix ou
 * boleto), mas trocar o tipo original espalharia o rename por todo mundo que
 * já importa `PixPaymentStatus`. Alias só para uso em código novo.
 */
export type PendingPaymentStatus = PixPaymentStatus;

/** Dados mínimos para exibir e acompanhar um boleto recém-gerado. */
export interface BoletoPaymentData {
  transactionId: string;
  boletoUrl: string;
  boletoBarcode: string;
  /** Vencimento já formatado para exibição (DD/MM/AAAA). */
  dueDate: string;
}

/**
 * Formata a data de vencimento de um boleto recém-gerado para exibição.
 *
 * A rota `/api/payments/asaas/create` (Task 9) não devolve `dueDate` na
 * resposta — o valor nunca foi persistido em `PaymentTransaction` nem
 * incluído no payload de retorno, e alterar isso é mudança de backend (fora
 * do escopo desta task). Nenhum chamador destes fluxos envia
 * `boletoDueDays` explícito, então o backend sempre usa o default de
 * `buildDueDate` (`platform/integrations/asaas/due-date.ts`): hoje + 3 dias
 * corridos, em `America/Sao_Paulo`. Replicamos a mesma conta aqui só para
 * exibição — o vencimento real e autoritativo é o que está impresso no PDF
 * do boleto (`boletoUrl`).
 */
export function formatBoletoDueDate(boletoDueDays = 3, now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + boletoDueDays);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

// Re-export formatCurrency as alias for formatBRL for backward compatibility
export { formatCurrency };
