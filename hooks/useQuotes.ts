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
        createdAt: candidate.createdAt,
        expiresAt: candidate.expiresAt,
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

              Object.entries(fieldErrors).forEach(([, messages]) => {
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
        // Try to get detailed error message from API
        let errorMessage = "Erro ao confirmar seleção";
        try {
          const errorData = await res.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }
      return (await res.json()) as QuoteSelectionResponse;
    },
  });

// Helper functions to map between API and frontend formats
type ApiRecipient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiRecipientList = {
  items: ApiRecipient[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const mapApiRecipientToFrontend = (api: ApiRecipient): Recipient => ({
  id: api.id,
  nome: api.name,
  telefone: api.phone || '',
  email: api.email || undefined,
  documento: api.document || '',
  cep: api.cep,
  logradouro: api.logradouro,
  numero: api.numero,
  complemento: api.complemento || undefined,
  bairro: api.bairro,
  cidade: api.cidade,
  uf: api.uf,
  observacoes: api.notes || undefined,
});

const mapFrontendRecipientToApi = (frontend: RecipientPayload) => ({
  name: frontend.nome,
  phone: frontend.telefone || null,
  email: frontend.email || null,
  document: frontend.documento || null,
  cep: frontend.cep,
  logradouro: frontend.logradouro,
  numero: frontend.numero,
  complemento: frontend.complemento || null,
  bairro: frontend.bairro,
  cidade: frontend.cidade,
  uf: frontend.uf,
  notes: frontend.observacoes || null,
  isDefault: false,
});

export const useRecipients = (cep?: string) =>
  useQuery<Recipient[]>({
    queryKey: ["account", "recipients", cep],
    queryFn: async () => {
      const res = await fetch(
        `/api/account/recipients${cep ? `?cep=${encodeURIComponent(cep)}` : ""}`,
      );
      if (!res.ok) {
        throw new Error("Erro ao carregar destinatários.");
      }
      const data = await res.json();
      // API returns paginated result, extract items
      const apiList = data.data as ApiRecipientList;
      return apiList.items.map(mapApiRecipientToFrontend);
    },
    enabled: Boolean(cep),
    staleTime: 60_000,
  });

export const useRecipientSave = () =>
  useMutation({
    mutationFn: async (payload: RecipientPayload) => {
      const apiPayload = mapFrontendRecipientToApi(payload);
      const res = await fetch("/api/account/recipients", {
        method: "POST",
        body: JSON.stringify(apiPayload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || "Erro ao salvar destinatário");
      }
      const data = await res.json();
      // Map response back to frontend format
      return mapApiRecipientToFrontend(data.data);
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
