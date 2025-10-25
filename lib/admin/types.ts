export type ClientType = 'PF' | 'PJ';
export type AccountStatus = 'active' | 'suspended' | 'blocked';

export interface AdminClient {
  id: string;
  type: ClientType;
  document: string; // CPF/CNPJ
  name: string;     // Razão social ou nome
  email: string;
  phone?: string | null;
  createdAt: string; // ISO
  status: AccountStatus;
  walletBalance: number;     // Saldo em carteira (R$)
  creditsMonth: number;      // Créditos no mês (R$)
  debitsMonth: number;       // Débitos no mês (R$)
}

export interface ClientsQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: ClientType | 'all';
  status?: AccountStatus | 'all';
}

export interface ClientsResponse {
  items: AdminClient[];
  page: number;
  pageSize: number;
  total: number;
}
