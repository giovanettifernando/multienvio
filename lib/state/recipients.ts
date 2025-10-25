"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Recipient = {
  id: string;
  name: string;
  doc?: string;        // CPF/CNPJ
  phone?: string;
  email?: string;
  cep: string;         // "58035-100"
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
};

type RecipientsStore = {
  items: Recipient[];
  add: (r: Recipient) => void;
  update: (id: string, r: Partial<Recipient>) => void;
  remove: (id: string) => void;
  upsertMany?: (arr: Recipient[]) => void;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useRecipientsStore = create<RecipientsStore>()(
  persist(
    (set) => ({
      items: [],
      add: (r) => set((s) => ({ items: [r, ...s.items] })),
      update: (id, updates) =>
        set((s) => ({
          items: s.items.map((x) => (x.id === id ? { ...x, ...updates } : x)),
        })),
      remove: (id) =>
        set((s) => ({
          items: s.items.filter((x) => x.id !== id),
        })),
      upsertMany: (arr) =>
        set((s) => {
          const map = new Map(s.items.map((x) => [x.id, x]));
          arr.forEach((a) => map.set(a.id || uid(), { ...a, id: a.id || uid() }));
          return { items: Array.from(map.values()) };
        }),
    }),
    {
      name: "envio.recipients.v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
