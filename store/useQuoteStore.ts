import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type {
  QuoteFormState,
  QuoteResultsState,
  QuoteSelectionState,
  QuoteSummary,
  QuoteVolume,
} from "@/types/quote";

type QuoteStoreState = {
  form: QuoteFormState | null;
  results: QuoteResultsState | null;
  selection: QuoteSelectionState | null;
  lastDestination: { cep: string; cidade?: string; uf?: string } | null;
  setForm: (summary: QuoteSummary) => void;
  patchForm: (patch: Partial<QuoteSummary>) => void;
  setVolumes: (volumes: QuoteVolume[]) => void;
  setResults: (payload: QuoteResultsState) => void;
  clearResults: () => void;
  setSelection: (selection: QuoteSelectionState) => void;
  clearSelection: () => void;
  reset: (options?: { keepForm?: boolean }) => void;
  updateSummary: (patch: Partial<QuoteSummary>) => void;
};

const nowIso = () => new Date().toISOString();

const toSummary = (form: QuoteFormState): QuoteSummary => ({
  origemCep: form.origemCep,
  origemCidade: form.origemCidade,
  origemUf: form.origemUf,
  origemLabel: form.origemLabel,
  origemIsDefault: form.origemIsDefault,
  destinoCep: form.destinoCep,
  destinoCidade: form.destinoCidade,
  destinoUf: form.destinoUf,
  coleta: form.coleta,
  devolucao: form.devolucao,
  volumes: form.volumes,
  seguroValor: form.seguroValor ?? null,
});

const fromSummary = (summary: QuoteSummary): QuoteFormState => ({
  origemCep: summary.origemCep,
  origemCidade: summary.origemCidade,
  origemUf: summary.origemUf,
  origemLabel: summary.origemLabel,
  origemIsDefault: summary.origemIsDefault,
  destinoCep: summary.destinoCep,
  destinoCidade: summary.destinoCidade,
  destinoUf: summary.destinoUf,
  coleta: summary.coleta,
  devolucao: summary.devolucao,
  volumes: summary.volumes,
  seguroValor: summary.seguroValor ?? null,
  updatedAt: nowIso(),
});

const emptyForm = (): QuoteFormState => ({
  origemCep: "",
  destinoCep: "",
  coleta: false,
  devolucao: false,
  volumes: [],
  seguroValor: null,
  origemCidade: undefined,
  origemUf: undefined,
  destinoCidade: undefined,
  destinoUf: undefined,
  origemLabel: undefined,
  origemIsDefault: undefined,
  updatedAt: nowIso(),
});

const mergeSummary = (
  base: QuoteSummary,
  patch: Partial<QuoteSummary>,
): QuoteSummary => ({
  origemCep: patch.origemCep ?? base.origemCep,
  origemCidade: patch.origemCidade ?? base.origemCidade,
  origemUf: patch.origemUf ?? base.origemUf,
  origemLabel: patch.origemLabel ?? base.origemLabel,
  origemIsDefault:
    patch.origemIsDefault ?? base.origemIsDefault,
  destinoCep: patch.destinoCep ?? base.destinoCep,
  destinoCidade: patch.destinoCidade ?? base.destinoCidade,
  destinoUf: patch.destinoUf ?? base.destinoUf,
  coleta: patch.coleta ?? base.coleta,
  devolucao: patch.devolucao ?? base.devolucao,
  volumes: patch.volumes ?? base.volumes,
  seguroValor:
    patch.seguroValor !== undefined ? patch.seguroValor : base.seguroValor,
});

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return noopStorage;
  }
  return window.localStorage;
});

export const useQuoteStore = create<QuoteStoreState>()(
  persist(
    (set) => ({
      form: null,
      results: null,
      selection: null,
      lastDestination: null,
      setForm: (summary) => set(() => ({ form: fromSummary(summary) })),
      patchForm: (patch) =>
        set((state) => {
          const currentSummary = mergeSummary(
            state.form ? toSummary(state.form) : toSummary(emptyForm()),
            patch,
          );
          return { form: fromSummary(currentSummary) };
        }),
      setVolumes: (volumes) =>
        set((state) => {
          const currentSummary = mergeSummary(
            state.form ? toSummary(state.form) : toSummary(emptyForm()),
            { volumes },
          );
          return { form: fromSummary(currentSummary) };
        }),
      setResults: (payload) =>
        set(() => ({
          results: payload,
          form: fromSummary(payload.resumo),
          lastDestination: payload.resumo.destinoCep
            ? {
                cep: payload.resumo.destinoCep,
                cidade: payload.resumo.destinoCidade,
                uf: payload.resumo.destinoUf,
              }
            : null,
          selection: null,
        })),
      updateSummary: (patch) =>
        set((state) => {
          if (!state.results) return {};
          const nextSummary = mergeSummary(state.results.resumo, patch);
          return {
            results: { ...state.results, resumo: nextSummary },
            form: fromSummary(nextSummary),
          };
        }),
      clearResults: () => set(() => ({ results: null, selection: null })),
      setSelection: (selection) => set(() => ({ selection })),
      clearSelection: () => set(() => ({ selection: null })),
      reset: (options) =>
        set((state) => ({
          form: options?.keepForm
            ? state.form
              ? fromSummary(toSummary(state.form))
              : emptyForm()
            : emptyForm(),
          results: null,
          selection: null,
          lastDestination: options?.keepForm
            ? state.lastDestination
            : null,
        })),
    }),
    {
      name: "quote-flow",
      storage,
      partialize: (state) => ({
        form: state.form,
        results: state.results,
        selection: state.selection,
        lastDestination: state.lastDestination,
      }),
    },
  ),
);
