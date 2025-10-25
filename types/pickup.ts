export type PickupStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "FAILED"
  | "CANCELED";

export type PickupEvent = {
  id: string;
  type: PickupStatus | "NOTE";
  description: string;
  occurredAt: string;
  operator?: string;
};

export type Pickup = {
  id: string;
  requestedAt: string;
  status: PickupStatus;
  sender: {
    razao: string;
    cnpj?: string;
    address: {
      cep: string;
      logradouro: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
    };
    contact?: {
      name?: string;
      phone?: string;
    };
  };
  schedule: {
    date: string;
    windowStart: string;
    windowEnd: string;
    notes?: string;
  };
  carrierPref?: "Correios" | "Jadlog" | "Loggi" | "J&T" | "ANY";
  shipments: Array<{
    id: string;
    serviceCode: string;
    weightKg: number;
    volumeCm3?: number;
    to: { name: string; cidade: string; uf: string; cep: string };
  }>;
  totals: { count: number; weightKg: number; volumeCm3: number };
  events: PickupEvent[];
  manifest?: { id: string; pdfUrl: string; generatedAt: string };
};
