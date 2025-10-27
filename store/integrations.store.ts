import { create } from 'zustand';
import type { Carrier, CarrierApi } from '@/lib/integrations/types';

interface IntegrationsState {
  // Drawer states
  carrierDrawerOpen: boolean;
  carrierDrawerMode: 'create' | 'edit';
  editingCarrier: Carrier | null;

  apiDrawerOpen: boolean;
  apiDrawerMode: 'create' | 'edit';
  editingApi: CarrierApi | null;
  selectedCarrierId: string | null;

  // Auth panel state
  authPanelCarrierId: string | null;

  // Actions
  openCarrierDrawer: (carrier?: Carrier) => void;
  closeCarrierDrawer: () => void;

  openApiDrawer: (carrierId: string, api?: CarrierApi) => void;
  closeApiDrawer: () => void;

  setAuthPanelCarrier: (carrierId: string | null) => void;
}

export const useIntegrationsStore = create<IntegrationsState>((set) => ({
  // Initial state
  carrierDrawerOpen: false,
  carrierDrawerMode: 'create',
  editingCarrier: null,

  apiDrawerOpen: false,
  apiDrawerMode: 'create',
  editingApi: null,
  selectedCarrierId: null,

  authPanelCarrierId: null,

  // Actions
  openCarrierDrawer: (carrier) =>
    set({
      carrierDrawerOpen: true,
      carrierDrawerMode: carrier ? 'edit' : 'create',
      editingCarrier: carrier || null,
    }),

  closeCarrierDrawer: () =>
    set({
      carrierDrawerOpen: false,
      editingCarrier: null,
    }),

  openApiDrawer: (carrierId, api) =>
    set({
      apiDrawerOpen: true,
      apiDrawerMode: api ? 'edit' : 'create',
      editingApi: api || null,
      selectedCarrierId: carrierId,
    }),

  closeApiDrawer: () =>
    set({
      apiDrawerOpen: false,
      editingApi: null,
      selectedCarrierId: null,
    }),

  setAuthPanelCarrier: (carrierId) =>
    set({
      authPanelCarrierId: carrierId,
    }),
}));
