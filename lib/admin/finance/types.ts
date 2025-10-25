export type Currency = 'BRL';
export type PaymentMethod = 'pix' | 'card' | 'boleto' | 'transfer';
export type TxNature = 'credit' | 'debit';
export type LedgerKind =
  | 'deposit'        // crédito de carteira (PIX/cartão/boleto)
  | 'purchase'       // débito por compra de etiqueta/coleta
  | 'fee'            // taxa plataforma
  | 'refund'         // estorno ao cliente
  | 'chargeback'     // chargeback do adquirente
  | 'commission'     // comissões pagas a canais/time
  | 'carrier_payout' // repasse a transportadora
  | 'adjustment';    // ajuste manual (admin)

export interface PeriodFilter {
  dateStart?: string; // ISO
  dateEnd?: string;   // ISO
}

export interface FinanceSummary {
  period: PeriodFilter;
  grossRevenue: number;        // receita bruta (R$)
  platformFees: number;        // taxas (R$)
  carrierPayouts: number;      // repasses (R$)
  partnerCommissions: number;  // comissões (R$)
  refunds: number;             // estornos (R$)
  chargebacks: number;         // chargebacks (R$)
  customersWalletBalance: number; // soma dos saldos em carteira
  platformOperationalBalance: number; // resultado operacional do período
}

export interface LedgerEntry {
  id: string;
  createdAt: string;      // ISO
  customerId: string;
  customerName: string;
  method?: PaymentMethod | null;
  carrier?: string | null;
  shipmentId?: string | null;
  kind: LedgerKind;
  nature: TxNature;       // credit/debit
  amount: number;         // R$
  fee?: number | null;    // R$ (taxa na operação)
  description?: string | null;
  reconciled: boolean;
}

export type InvoiceStatus = 'open' | 'paid' | 'canceled';
export interface Invoice {
  id: string;
  issueDate: string;     // ISO
  dueDate?: string | null;
  status: InvoiceStatus;
  customerId?: string | null; // se aplicável
  customerName?: string | null;
  total: number;         // R$
  link?: string | null;  // URL da fatura/nota (mock)
}

export type PayoutStatus = 'pending' | 'paid' | 'failed';
export interface CarrierPayout {
  id: string;
  periodStart: string; // ISO
  periodEnd: string;   // ISO
  carrier: string;
  amount: number;
  status: PayoutStatus;
  reference?: string | null; // ex: Nº remessa
  proofUrl?: string | null;  // comprovante (mock)
}

export type CommissionStatus = 'calculated' | 'approved' | 'paid';
export interface CommissionItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  agentType: 'channel' | 'sales';
  agentName: string;
  amount: number;
  status: CommissionStatus;
}

export type ChargebackStatus = 'review' | 'approved' | 'denied';
export interface ChargebackItem {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  method: PaymentMethod;
  amount: number;
  status: ChargebackStatus;
  reason?: string | null;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListParams extends PeriodFilter {
  page?: number;
  pageSize?: number;
  q?: string; // cliente/documento/descrição
  customerId?: string;
  carrier?: string;
  method?: string; // 'pix'|'card'|'boleto'|'transfer'
  status?: string;
  kind?: string;   // LedgerKind
  reconciled?: boolean;
}
