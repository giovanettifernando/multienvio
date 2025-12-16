"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type QuoteDestination = {
  mode: "manual" | "recipient";
  cep: string;            // 8 dígitos mascarado "00000-000"
  city?: string;
  state?: string;
  street?: string | null;
  neighborhood?: string | null;
  recipientId?: string;   // quando vier de recorrente
  recipientName?: string; // opcional p/ conveniência
};

type DraftStore = {
  destination?: QuoteDestination;
  pickupAtOrigin: boolean;
  recipientPays: boolean;
  setDestination: (d: QuoteDestination) => void;
  setPickupAtOrigin: (pickup: boolean) => void;
  setRecipientPays: (recipientPays: boolean) => void;
  clear: () => void;
  _hasHydrated: boolean;
};

export const useQuoteDraft = create<DraftStore>()(
  persist(
    (set, get) => ({
      destination: undefined,
      pickupAtOrigin: false,
      recipientPays: false,
      setDestination: (d) => set({ destination: d }),
      setPickupAtOrigin: (pickup) => set({ pickupAtOrigin: pickup }),
      setRecipientPays: (recipientPays) => set({ recipientPays }),
      clear: () => set({ destination: undefined, pickupAtOrigin: false, recipientPays: false }),
      _hasHydrated: false,
    }),
    {
      name: "envio.quoteDraft.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ destination: s.destination, pickupAtOrigin: s.pickupAtOrigin, recipientPays: s.recipientPays }),
      onRehydrateStorage: () => (state) => {
        // Marca como hidratado após carregar do localStorage
        if (state) {
          state._hasHydrated = true;
        }
      },
    }
  )
);
