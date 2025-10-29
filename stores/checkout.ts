import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CheckoutState {
  pickupPointId: string | null;
  remetente?: {
    cep?: string;
    cidade?: string;
    uf?: string;
  } | null;
}

interface CheckoutActions {
  setPickupPoint: (id: string | null) => void;
  setRemetente: (data: CheckoutState['remetente']) => void;
  clearCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState & CheckoutActions>()(
  persist(
    (set) => ({
      pickupPointId: null,
      remetente: null,

      setPickupPoint: (id) => set({ pickupPointId: id }),

      setRemetente: (data) => set({ remetente: data }),

      clearCheckout: () => set({ pickupPointId: null, remetente: null }),
    }),
    {
      name: 'envio-legal-checkout',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
