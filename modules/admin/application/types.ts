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
  walletBalance: number;     // Saldo em carteira (centavos)
  creditsMonth: number;      // Créditos no mês (centavos)
  debitsMonth: number;       // Débitos no mês (centavos)
  walletPendingCents?: number; // Saldo pendente em centavos (opcional)
  totalShipments?: number; // Total de envios do cliente (opcional)
  emailVerified?: boolean; // Email confirmado
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
