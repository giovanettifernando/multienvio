'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CheckoutState {
  remetente?: {
    cep?: string;
    cidade?: string;
    uf?: string;
  } | null;
}

interface CheckoutActions {
  setRemetente: (data: CheckoutState['remetente']) => void;
  clearCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState & CheckoutActions>()(
  persist(
    (set) => ({
      remetente: null,


      setRemetente: (data) => set({ remetente: data }),

      clearCheckout: () => set({ remetente: null }),
    }),
    {
      name: 'envio-legal-checkout',
      storage: createJSONStorage(() => localStorage),
      version: 4, // Sobe a versão para descartar pickupPointId do storage
    }
  )
);
