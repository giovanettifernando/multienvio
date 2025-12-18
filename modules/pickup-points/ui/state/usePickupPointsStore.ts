import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PickupPointStatus } from '@/shared/types/contracts';
import type {
  PickupPoint,
  PickupPointFormData,
  StatusOperacional,
} from "@/modules/pickup-points/application/types";
import { generateUUID } from "@/shared/utils/uuid";

type State = {
  points: PickupPoint[];
  defaultPointId: string | null;
};

type Actions = {
  createPoint: (data: PickupPointFormData) => PickupPoint;
  updatePoint: (id: string, data: Partial<PickupPointFormData>) => void;
  deletePoint: (id: string) => void;
  toggleStatus: (id: string) => void;
  setDefaultPoint: (id: string | null) => void;
  getActivePoints: () => PickupPoint[];
  getPointsByLocation: (uf?: string, cidade?: string) => PickupPoint[];
  subscribeExternal: () => () => void;
};

const STORAGE_KEY = 'envio-legal-pontos';
const CHANNEL_NAME = 'pontos-coleta-channel';

let broadcastChannel: BroadcastChannel | null = null;

// Inicializar BroadcastChannel apenas no cliente
if (typeof window !== 'undefined') {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

function broadcastChange(action: string, data?: any) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ action, data, timestamp: Date.now() });
  }
}

export const usePontosStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      points: [],
      defaultPointId: null,

      createPoint: (data) => {
        const now = new Date().toISOString();
        const newPoint: PickupPoint = {
          id: generateUUID(),
          status: PickupPointStatus.ACTIVE,
          ...data,
          ie: data.ie || null,
          email: data.email || null,
          telefone: data.telefone || null,
          cep: data.cep || null,
          logradouro: data.logradouro || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          uf: data.uf || null,
          geo: data.geo || null,
          payoutDay: data.payoutDay || null,
          minPayoutAmount: data.minPayoutAmount || null,
          commissionPerItem: data.commissionPerItem || null,
          capacityPerDay: data.capacityPerDay || null,
          monthlyReceived: 0,
          createdAt: now,
          updatedAt: now,
        };

        set({ points: [newPoint, ...get().points] });
        broadcastChange("create", newPoint);
        return newPoint;
      },

      updatePoint: (id, data) => {
        set({
          points: get().points.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...data,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        });
        broadcastChange('update', { id, data });
      },

      deletePoint: (id) => {
        set({
          points: get().points.filter((p) => p.id !== id),
          defaultPointId: get().defaultPointId === id ? null : get().defaultPointId,
        });
        broadcastChange('delete', id);
      },

      toggleStatus: (id) => {
        set({
          points: get().points.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status:
                    p.status === PickupPointStatus.ACTIVE
                      ? PickupPointStatus.BLOCKED
                      : PickupPointStatus.ACTIVE,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        });
        broadcastChange("toggleStatus", id);
      },

      setDefaultPoint: (id) => {
        set({ defaultPointId: id });
        broadcastChange('setDefault', id);
      },

      getActivePoints: () => {
        return get().points.filter((p) => p.status === PickupPointStatus.ACTIVE);
      },

      getPointsByLocation: (uf?, cidade?) => {
        const points = get().getActivePoints();

        if (!uf) return points;

        // Priorizar mesma cidade/UF, depois mesma UF, depois resto
        const sameCity = points.filter(
          (p) => p.uf === uf && p.cidade === cidade
        );
        const sameUf = points.filter(
          (p) => p.uf === uf && p.cidade !== cidade
        );
        const others = points.filter((p) => p.uf !== uf);

        return [...sameCity, ...sameUf, ...others];
      },

      subscribeExternal: () => {
        if (typeof window === 'undefined' || !broadcastChannel) return () => {};

        let timeoutId: NodeJS.Timeout;
        const handler = (event: MessageEvent) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            // Recarregar do localStorage quando outra aba faz mudanças
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            try {
              const json = JSON.parse(raw);
              if (json?.state?.points) {
                set({
                  points: json.state.points,
                  defaultPointId: json.state.defaultPointId || null,
                });
              }
            } catch (err) {
              console.error('Failed to sync pontos store:', err);
            }
          }, 300);
        };

        broadcastChannel.addEventListener('message', handler);

        return () => {
          broadcastChannel?.removeEventListener('message', handler);
          clearTimeout(timeoutId);
        };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        points: state.points,
        defaultPointId: state.defaultPointId,
      }),
    }
  )
);
