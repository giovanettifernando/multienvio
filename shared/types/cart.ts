import type { CEP, QuoteVolume } from '@/shared/types/quote';

// Nova estrutura de CartItem do banco de dados
export type CartItemSnapshot = {
  id: string;
  originAddress: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    complemento?: string;
    nome?: string;
    telefone?: string;
    email?: string;
    documento?: string;
  };
  destination: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    complemento?: string;
    nome?: string;
    telefone?: string;
    email?: string;
    documento?: string;
  };
  volumes: Array<{
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    pesoKg: number;
    pesoCubadoKg?: number;
    idx?: number;
  }>;
  preferences: {
    reverse?: boolean;
    reminder?: string;
  };
  insuranceValue?: number;
  selectedQuote: {
    carrier: string;
    serviceCode?: string;
    serviceName: string;
    price: number;
    deadlineDays: number;
    source?: 'real' | 'error' | 'quote';
  };
  totals: {
    subtotal?: number;
    desconto?: number;
    taxas?: number;
    total: number;
    moeda: string;
  };
  createdAt: string;
  updatedAt: string;
};

// Estrutura legada para compatibilidade com código antigo
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

// Estrutura do carrinho usada no frontend (legado)
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
