"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CollectionStatus } from "@/types/contracts";
import type { Coleta, CreateColetaInput, UpdateColetaInput, ColetaStatus } from "@/lib/coletas/types";
import { generateUUID } from "@/lib/utils/uuid";

const STORAGE_KEY = "envio-legal-coletas";
const STORAGE_VERSION = 1;

// BroadcastChannel para sincronizar entre abas
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined") {
  broadcastChannel = new BroadcastChannel(STORAGE_KEY);
}

interface State {
  coletas: Coleta[];
}

interface Actions {
  // Criar nova coleta
  create: (input: CreateColetaInput) => Coleta;

  // Atualizar coleta existente
  update: (id: string, input: UpdateColetaInput) => void;

  // Atualizar apenas status
  updateStatus: (id: string, status: ColetaStatus) => void;

  // Remover coleta
  remove: (id: string) => void;

  // Buscar coleta por shipmentId
  findByShipmentId: (shipmentId: string) => Coleta | undefined;

  // Inscrever em mudanças externas (outras abas)
  subscribeExternal: () => () => void;

  // Migração de dados legados (se houver)
  hydrateFromLegacy: () => void;
}

function broadcastChange(action: string, data?: unknown) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ action, data, timestamp: Date.now() });
  }
}

export const useColetasStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      coletas: [],

      create: (input: CreateColetaInput) => {
        const now = new Date().toISOString();

        // Verificar se já existe coleta para este shipmentId
        const existing = get().findByShipmentId(input.shipmentId);
        if (existing) {
          // Atualizar a existente ao invés de criar duplicada
          get().update(existing.id, {
            status: input.janelaColeta
              ? CollectionStatus.AGENDADA
              : CollectionStatus.ABERTA,
            janelaColeta: input.janelaColeta,
            observacoes: input.observacoes,
          });
          return existing;
        }

        const newColeta: Coleta = {
          id: generateUUID(),
          shipmentId: input.shipmentId,
          status: input.janelaColeta
            ? CollectionStatus.AGENDADA
            : CollectionStatus.ABERTA,
          origem: input.origem,
          janelaColeta: input.janelaColeta ?? null,
          transportadora: input.transportadora ?? null,
          servico: input.servico ?? null,
          observacoes: input.observacoes ?? null,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          coletas: [newColeta, ...state.coletas],
        }));

        broadcastChange("create", newColeta);
        return newColeta;
      },

      update: (id: string, input: UpdateColetaInput) => {
        const now = new Date().toISOString();

        set((state) => ({
          coletas: state.coletas.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(input.status !== undefined && { status: input.status }),
                  ...(input.janelaColeta !== undefined && {
                    janelaColeta: input.janelaColeta,
                  }),
                  ...(input.observacoes !== undefined && {
                    observacoes: input.observacoes,
                  }),
                  updatedAt: now,
                }
              : c
          ),
        }));

        broadcastChange("update", { id, input });
      },

      updateStatus: (id: string, status: ColetaStatus) => {
        get().update(id, { status });
      },

      remove: (id: string) => {
        set((state) => ({
          coletas: state.coletas.filter((c) => c.id !== id),
        }));

        broadcastChange("remove", { id });
      },

      findByShipmentId: (shipmentId: string) => {
        return get().coletas.find((c) => c.shipmentId === shipmentId);
      },

      subscribeExternal: () => {
        if (!broadcastChannel) return () => {};

        let timeoutId: NodeJS.Timeout;

        const handler = (event: MessageEvent) => {
          // Debounce para evitar múltiplos reloads
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.state?.coletas) {
                  set({ coletas: parsed.state.coletas });
                }
              } catch (error) {
                console.error("Erro ao parsear coletas do localStorage:", error);
              }
            }
          }, 300);
        };

        broadcastChannel.addEventListener("message", handler);

        return () => {
          broadcastChannel?.removeEventListener("message", handler);
          clearTimeout(timeoutId);
        };
      },

      hydrateFromLegacy: () => {
        // Placeholder para migração futura se necessário
        console.log("Hydration from legacy data não implementado");
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: STORAGE_VERSION,
    }
  )
);
