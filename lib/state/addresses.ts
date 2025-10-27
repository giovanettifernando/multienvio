"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Address = {
  id: string;
  apelido: string;        // "Matriz", "Filial", etc.
  cep: string;            // "80030-000"
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  isDefault?: boolean;
};

type AddressStore = {
  items: Address[];
  selectedOriginId: string | null;
  add: (a: Address, opts?: { select?: boolean }) => void;
  update: (id: string, a: Partial<Address>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
  selectOrigin: (id: string | null) => void;
  upsertMany?: (arr: Address[]) => void; // opcional para migração de mocks
  clearAll: () => void;                  // util de debug
  getDefaultId: () => string | null;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useAddressStore = create<AddressStore>()(
  persist(
    (set, get) => ({
      items: [],
      selectedOriginId: null,

      add: (a, opts) => {
        set((s) => ({ items: [a, ...s.items] }));
        if (opts?.select) get().selectOrigin(a.id);
      },

      update: (id, updates) =>
        set((s) => ({
          items: s.items.map((x) => (x.id === id ? { ...x, ...updates } : x)),
        })),

      remove: (id) =>
        set((s) => ({
          items: s.items.filter((x) => x.id !== id),
          selectedOriginId: s.selectedOriginId === id ? null : s.selectedOriginId,
        })),

      setDefault: (id) =>
        set((s) => ({
          items: s.items.map((x) => ({ ...x, isDefault: x.id === id })),
        })),

      selectOrigin: (id) => set(() => ({ selectedOriginId: id })),

      upsertMany: (arr) =>
        set((s) => {
          const map = new Map(s.items.map((x) => [x.id, x]));
          arr.forEach((a) => map.set(a.id || uid(), { ...a, id: a.id || uid() }));
          return { items: Array.from(map.values()) };
        }),

      clearAll: () => set({ items: [], selectedOriginId: null }),

      getDefaultId: () => {
        const d = get().items.find((x) => x.isDefault);
        return d ? d.id : get().items[0]?.id ?? null;
      },
    }),
    {
      name: "envio.addresses.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, selectedOriginId: s.selectedOriginId }),
    }
  )
);

// Export auxiliar para criar rapidamente Address a partir de form
export function makeAddressFromForm(f: Partial<Address> & { apelido?: string }): Address {
  return {
    id: uid(),
    apelido: f?.apelido ?? "Empresa",
    cep: f?.cep ?? "",
    logradouro: f?.logradouro ?? "",
    numero: f?.numero ?? "",
    complemento: f?.complemento ?? "",
    bairro: f?.bairro ?? "",
    cidade: f?.cidade ?? "",
    uf: f?.uf ?? "",
    isDefault: !!f?.isDefault,
  };
}

export type CompanyAddress = {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  nome?: string;
  email?: string;
  telefone?: string;
};

export function getCompanyDefaultAddress(): CompanyAddress | null {
  const state = useAddressStore.getState();
  const address =
    state.items.find((item) => item.isDefault) ?? state.items[0] ?? null;

  if (!address) return null;

  return {
    cep: address.cep,
    logradouro: address.logradouro,
    numero: address.numero,
    complemento: address.complemento,
    bairro: address.bairro,
    cidade: address.cidade,
    uf: address.uf,
    nome: address.apelido,
  };
}
