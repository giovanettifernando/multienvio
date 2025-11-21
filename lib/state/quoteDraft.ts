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
  setDestination: (d: QuoteDestination) => void;
  setPickupAtOrigin: (pickup: boolean) => void;
  clear: () => void;
  _hasHydrated: boolean;
};

export const useQuoteDraft = create<DraftStore>()(
  persist(
    (set, get) => ({
      destination: undefined,
      pickupAtOrigin: false,
      setDestination: (d) => {
        console.log('[useQuoteDraft] setDestination() chamado:', JSON.stringify(d, null, 2));
        set({ destination: d });
      },
      setPickupAtOrigin: (pickup) => {
        console.log('[useQuoteDraft] setPickupAtOrigin() chamado:', pickup);
        set({ pickupAtOrigin: pickup });
      },
      clear: () => {
        console.log('[useQuoteDraft] clear() chamado');
        console.log('[useQuoteDraft] Estado ANTES do clear:', JSON.stringify({
          destination: get().destination,
          pickupAtOrigin: get().pickupAtOrigin,
        }, null, 2));
        set({ destination: undefined, pickupAtOrigin: false });
        console.log('[useQuoteDraft] Estado APÓS clear:', JSON.stringify({
          destination: get().destination,
          pickupAtOrigin: get().pickupAtOrigin,
        }, null, 2));
      },
      _hasHydrated: false,
    }),
    {
      name: "envio.quoteDraft.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ destination: s.destination, pickupAtOrigin: s.pickupAtOrigin }),
      onRehydrateStorage: () => (state) => {
        // Marca como hidratado após carregar do localStorage
        if (state) {
          state._hasHydrated = true;
        }
      },
    }
  )
);
