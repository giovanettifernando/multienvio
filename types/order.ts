export type OrderStatus =
  | "NEW"
  | "QUOTED"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED";

export type OrderEvent = {
  id: string;
  type:
    | "CREATED"
    | "QUOTED"
    | "SERVICE_SELECTED"
    | "LABEL_EMITTED"
    | "CANCELED"
    | "NOTE";
  description: string;
  occurredAt: string;
};

export type OrderItem = {
  sku?: string;
  name: string;
  qty: number;
  unitPrice?: number;
  weightKg?: number;
  dims?: { C?: number; L?: number; A?: number };
};

export type Order = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    doc?: string;
    address: {
      cep: string;
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      uf: string;
    };
  };
  package: {
    pesoKg: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    declaredValue?: number;
    category?: "ELETRONICOS" | "ROUPAS" | "GERAL";
  };
  preferences?: {
    prioridade?: number;
    adicionais?: {
      seguro?: boolean;
      avisoRecebimento?: boolean;
      maoPropria?: boolean;
    };
    usarTabelaContratada?: boolean;
    carrierFilter?: string[];
  };
  items?: OrderItem[];
  quoteId?: string;
  selectedService?: {
    serviceCode: string;
    price: number;
    etaDays: number;
  };
  shipmentId?: string;
  nf?: {
    number?: string;
    key?: string;
  };
  events: OrderEvent[];
};
