import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ColetorSession {
  id: string;
  status: 'active' | 'inactive' | 'blocked';
  pfNome: string;
  pfEmail: string;
  pfCelular: string;
  pjRazaoSocial: string;
  pjCnpj: string;
}

interface ColetorSessionState {
  coletor: ColetorSession | null;
  setColetor: (coletor: ColetorSession) => void;
  clearColetor: () => void;
}

export const useColetorSession = create<ColetorSessionState>()(
  persist(
    (set) => ({
      coletor: null,
      setColetor: (coletor) => set({ coletor }),
      clearColetor: () => set({ coletor: null }),
    }),
    {
      name: 'coletor-session',
    }
  )
);
