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
        quoteId: candidate.quoteId,
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
      const requestId = `FE-${Date.now()}`;
      console.log(`[HOOK][${requestId}] Iniciando cálculo de cotações`);
      console.log(`[HOOK][${requestId}] Payload:`, JSON.stringify(payload, null, 2));

      try {
        console.log(`[HOOK][${requestId}] Enviando POST /api/cotacoes...`);
        const res = await fetch("/api/cotacoes", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });

        console.log(`[HOOK][${requestId}] Resposta recebida:`, {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
        });

        if (!res.ok) {
          let errorBody;
          try {
            errorBody = await res.json();
          } catch {
            errorBody = await res.text();
          }
          console.error(`[HOOK][${requestId}] Erro HTTP ${res.status}:`, errorBody);

          // Se for erro 400 de validação, criar mensagem amigável
          if (res.status === 400 && errorBody && typeof errorBody === 'object') {
            const errors = errorBody as { message?: string; errors?: { fieldErrors?: Record<string, string[]> } };
            if (errors.errors?.fieldErrors) {
              const fieldErrors = errors.errors.fieldErrors;
              const errorMessages: string[] = [];

              Object.entries(fieldErrors).forEach(([field, messages]) => {
                if (Array.isArray(messages)) {
                  errorMessages.push(...messages);
                }
              });

              if (errorMessages.length > 0) {
                throw new Error(`Validação falhou:\n${errorMessages.join('\n')}`);
              }
            }
          }

          throw new Error(`Erro ao calcular cotações: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log(`[HOOK][${requestId}] Data recebida:`, data);
        console.log(`[HOOK][${requestId}] Type of data:`, typeof data, Array.isArray(data));

        console.log(`[HOOK][${requestId}] Chamando parseQuoteResponse...`);
        const parsed = parseQuoteResponse(data);
        console.log(`[HOOK][${requestId}] Parse OK:`, {
          hasQuoteId: !!parsed.quoteId,
          resultsCount: parsed.results?.length || 0,
          hasPontos: !!parsed.pontosParceiros,
        });

        return parsed;
      } catch (error) {
        console.error(`[HOOK][${requestId}] ERRO CAPTURADO:`, error);
        console.error(`[HOOK][${requestId}] Error type:`, typeof error);
        console.error(`[HOOK][${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
        throw error;
      }
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
