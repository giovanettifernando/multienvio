/** Tipos das telas de financeiro do painel (resumo, repasses e listas paginadas). */

export interface PeriodFilter {
  dateStart?: string; // ISO
  dateEnd?: string;   // ISO
}

export interface FinanceSummary {
  period: PeriodFilter;
  grossRevenue: number;        // receita bruta (R$)
  platformFees: number;        // taxas (R$)
  carrierPayouts: number;      // repasses (R$)
  refunds: number;             // estornos (R$)
  chargebacks: number;         // chargebacks (R$)
  customersWalletBalance: number; // soma dos saldos em carteira
  platformOperationalBalance: number; // resultado operacional do período
}

// Tipos para cálculo de repasses (reconciliação com transportadoras)
export interface CarrierPayoutShipment {
  id: string;
  platformTrackingCode: string;
  carrierTrackingCode: string | null;
  carrier: string;
  service: string | null;
  labelStatus: string;
  labelPriceCents: number;
  freightCostReais: number;
  platformCommissionCents: number;
  netPayoutReais: number;
  postedAt: string | null;
  createdAt: string;
  destinationCity: string;
  destinationState: string;
}

export interface CarrierPayoutSummary {
  carrier: string;
  shipmentCount: number;
  grossAmountCents: number;
  grossAmountReais: number;
  platformCommissionCents: number;
  platformCommissionReais: number;
  netPayoutCents: number;
  netPayoutReais: number;
  shipments: CarrierPayoutShipment[];
}

export interface CarrierPayoutsResponse {
  period: {
    dateStart: string;
    dateEnd: string;
  };
  summary: {
    totalShipments: number;
    totalGrossReais: number;
    totalPlatformCommissionReais: number;
    totalNetPayoutReais: number;
  };
  carriers: CarrierPayoutSummary[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
