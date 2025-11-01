import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  QuoteCalculateResponse,
  QuoteRequestPayload,
  QuoteSelectionPayload,
  QuoteSelectionResponse,
  PostingUnit,
  Recipient,
  RecipientPayload,
  UnitFilters,
} from "@/types/quote";

const parseQuoteResponse = (data: unknown): QuoteCalculateResponse => {
  if (Array.isArray(data)) {
    return { results: data };
  }
  if (data && typeof data === "object") {
    const candidate = data as Partial<QuoteCalculateResponse & { results?: unknown }>;
    if (Array.isArray(candidate.results)) {
      return {
        results: candidate.results,
        pontosParceiros: candidate.pontosParceiros,
      };
    }
  }
  throw new Error("Resposta de cotação inválida.");
};

export const useQuoteCalculate = () =>
  useMutation({
    mutationFn: async (
      payload: QuoteRequestPayload,
    ): Promise<QuoteCalculateResponse> => {
      const res = await fetch("/api/cotacoes", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Erro ao calcular cotações");
      }
      const data = await res.json();
      return parseQuoteResponse(data);
    },
  });

export const useQuoteSelection = () =>
  useMutation({
    mutationFn: async (
      payload: QuoteSelectionPayload,
    ): Promise<QuoteSelectionResponse> => {
      const res = await fetch("/api/cotacoes/selecionar", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Erro ao confirmar seleção");
      }
      return (await res.json()) as QuoteSelectionResponse;
    },
  });

export const useRecipients = (cep?: string) =>
  useQuery<Recipient[]>({
    queryKey: ["recipients", cep],
    queryFn: async () => {
      const res = await fetch(
        `/api/recipients${cep ? `?cep=${encodeURIComponent(cep)}` : ""}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        throw new Error("Erro ao carregar destinatários.");
      }
      return (await res.json()) as Recipient[];
    },
    enabled: Boolean(cep),
    staleTime: 60_000,
  });

export const useRecipientSave = () =>
  useMutation({
    mutationFn: async (payload: RecipientPayload) => {
      const res = await fetch("/api/recipients", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Erro ao salvar destinatário");
      }
      return res.json();
    },
  });

export const useUnits = (filters: UnitFilters) =>
  useQuery<PostingUnit[]>({
    queryKey: ["units", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.cep) params.set("cep", filters.cep);
      if (filters.ampliarAlcance) params.set("ampliar", "true");
      if (filters.estadosProximos) params.set("estadosProximos", "true");
      const res = await fetch(`/api/units?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Erro ao listar unidades.");
      }
      return (await res.json()) as PostingUnit[];
    },
    enabled: Boolean(filters.cep),
    staleTime: 5 * 60 * 1000,
  });
