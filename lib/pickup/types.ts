export type StatusOperacional = 'active' | 'blocked';

export type PixType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export type MetodoPagamento =
  | { kind: 'pix'; pixType: PixType; pixKey: string }
  | { kind: 'transfer'; bankCode: string; branch: string; account: string; accountType: 'corrente' | 'poupanca'; holderName: string; holderDocument: string };

export interface PickupPoint {
  id: string;
  status: StatusOperacional;

  // PJ
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie?: string | null;
  email?: string | null;
  telefone?: string | null;

  // Endereço
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;

  // Pagamento/Comissões
  paymentMethod: MetodoPagamento;
  payoutDay?: number | null;
  minPayoutAmount?: number | null;

  // Operação
  capacityPerDay?: number | null;

  updatedAt: string;
  createdAt: string;
}

// Tipo inferido do schema Zod - deve corresponder exatamente ao schema
export type PickupPointFormData = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie?: string;
  email: string;
  telefone: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  paymentMethod: MetodoPagamento;
  payoutDay?: number;
  minPayoutAmount?: number;
  capacityPerDay?: number | null;
};

export interface PickupPointFilters {
  q?: string;
  status?: 'active' | 'blocked' | 'all';
  uf?: string;
  cidade?: string;
  page?: number;
  pageSize?: number;
  sort?: 'name_asc' | 'name_desc' | 'updated_desc' | 'updated_asc';
}

export interface PickupPointListResponse {
  items: PickupPoint[];
  total: number;
  page: number;
  pageSize: number;
}
