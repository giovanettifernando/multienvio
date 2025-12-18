export type LedgerType =
  | "CREDIT"
  | "DEBIT"
  | "REFUND"
  | "FEE"
  | "ADJUST";

export type LedgerSource =
  | "TOPUP_PIX"
  | "TOPUP_CARD"
  | "SHIPMENT_LABEL"
  | "ORDER"
  | "REFUND_LABEL"
  | "MANUAL";

export type LedgerEntry = {
  id: string;
  occurredAt: string;
  type: LedgerType;
  source: LedgerSource;
  amount: number;
  currency: "BRL";
  description: string;
  ref?: {
    shipmentId?: string;
    orderId?: string;
    labelId?: string;
    invoiceId?: string;
    topupId?: string;
  };
  balanceAfter: number;
};

export type Wallet = {
  id: string;
  balance: number;
  currency: "BRL";
  updatedAt: string;
};

export type CardMethod = {
  id: string;
  brand: "visa" | "mastercard" | "amex" | "elo" | "hiper" | "other";
  last4: string;
  expMonth: number;
  expYear: number;
  holder: string;
  token: string;
  isDefault?: boolean;
};

export type PixTopup = {
  id: string;
  amount: number;
  currency?: "BRL";
  status: "PENDING" | "CONFIRMED" | "EXPIRED";
  qrCode: string;
  expiresAt?: string;
  referenceId?: string;
};

export type Invoice = {
  id: string;
  number: string;
  pdfUrl: string;
  amount: number;
  currency: "BRL";
  period?: {
    from: string;
    to: string;
  };
  createdAt: string;
};
