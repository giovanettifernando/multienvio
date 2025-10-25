import type { CEP, QuoteVolume } from "@/types/quote";

export type CartItem = {
  id: string;
  selectionId: string;
  quoteId: string;
  transportadora: string;
  modalidade: string;
  prazoEstimadoDias: number;
  prazoDias?: number;
  preco: number;
  quantidade: number;
  origem: { cep: CEP; cidadeUF?: string };
  destino: { cep: CEP; cidadeUF?: string };
  destinatario?: {
    nome?: string;
    cidade?: string;
    uf?: string;
  };
  devolucao: boolean;
  coleta: boolean;
  volumes: QuoteVolume[];
  pesoTotalKg: number;
  pesoCubadoTotalKg: number;
  documento: "NFE" | "DECLARACAO";
  aceitouDeclaracao: boolean;
  valorSeguro?: number | null;
  avisoRecebimento?: boolean;
  status?: "OK" | "INCOMPLETE" | "ERROR";
  labelUrl?: string;
  trackingCode?: string;
  trackingUrl?: string;
};

export type Cart = {
  items: CartItem[];
  subtotal: number;
  descontos: number;
  taxas: number;
  total: number;
  currency: "BRL";
};

export type CartUpdatableFields = Partial<
  Pick<CartItem, "quantidade" | "avisoRecebimento" | "valorSeguro">
>;

export type CheckoutPayload = {
  pagamento: {
    metodo: "WALLET" | "PIX" | "CARD" | "BOLETO";
  };
};

export type CheckoutResponse = {
  ok: boolean;
  orderId?: string;
  etiquetaIds?: string[];
  redirectUrl?: string;
  message?: string;
};
