import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CollectorSession {
  pointId: string;
  cnpj: string;
  nomeFantasia: string;
  razaoSocial?: string;
  email?: string | null;
  telefone?: string | null;
  address?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  };
  commissionPerItem?: number | null;
  monthlyReceived?: number;
}

interface CollectorSessionState {
  collector: CollectorSession | null;
  setCollector: (collector: CollectorSession) => void;
  clearCollector: () => void;
}

export const useCollectorSession = create<CollectorSessionState>()(
  persist(
    (set) => ({
      collector: null,
      setCollector: (collector) => set({ collector }),
      clearCollector: () => set({ collector: null }),
    }),
    {
      name: 'collector-session',
    }
  )
);
