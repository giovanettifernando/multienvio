"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Recipient = {
  id: string;
  name: string;
  doc?: string;
  phone?: string;
  email?: string;
  notes?: string;
  cep: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  isDefault?: boolean;
};

type RecipientsStore = {
  items: Recipient[];
  setAll: (recipients: Recipient[]) => void;
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
      setAll: (recipients) =>
        set({ items: recipients }),
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
