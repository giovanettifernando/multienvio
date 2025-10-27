/**
 * React Query hooks para coletas
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { coletasKeys } from "./queryKeys";
import type {
  Coleta,
  ColetaFilters,
  ColetaListResponse,
  CreateColetaInput,
  UpdateColetaInput,
} from "./types";

/**
 * Fetch coletas list with filters
 */
async function fetchColetas(
  filters?: ColetaFilters
): Promise<ColetaListResponse> {
  const params = new URLSearchParams();

  if (filters?.q) params.set("q", filters.q);
  if (filters?.status && filters.status !== "all")
    params.set("status", filters.status);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.pageSize) params.set("pageSize", filters.pageSize.toString());
  if (filters?.sort) params.set("sort", filters.sort);

  const res = await fetch(`/api/mock/coletas?${params.toString()}`);
  if (!res.ok) throw new Error("Erro ao carregar coletas");
  return res.json();
}

/**
 * Fetch single coleta
 */
async function fetchColeta(id: string): Promise<Coleta> {
  const res = await fetch(`/api/mock/coletas/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar coleta");
  return res.json();
}

/**
 * Create coleta
 */
async function createColeta(data: CreateColetaInput): Promise<Coleta> {
  const res = await fetch("/api/mock/coletas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao criar coleta");
  }

  return res.json();
}

/**
 * Update coleta (reagendar)
 */
async function updateColeta(
  id: string,
  data: UpdateColetaInput
): Promise<Coleta> {
  const res = await fetch(`/api/mock/coletas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao reagendar coleta");
  }

  return res.json();
}

/**
 * Delete coleta
 */
async function deleteColeta(id: string): Promise<void> {
  const res = await fetch(`/api/mock/coletas/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao cancelar coleta");
  }
}

// ====================
// HOOKS
// ====================

export function useColetas(filters?: ColetaFilters) {
  const queryKey = filters
    ? coletasKeys.list(JSON.stringify(filters))
    : coletasKeys.lists();

  return useQuery({
    queryKey,
    queryFn: () => fetchColetas(filters),
    staleTime: 30_000, // 30 seconds
  });
}

export function useColeta(id: string) {
  return useQuery({
    queryKey: coletasKeys.detail(id),
    queryFn: () => fetchColeta(id),
    enabled: !!id,
  });
}

export function useCreateColeta() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: createColeta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coletasKeys.lists() });
      message.success("Coleta criada com sucesso");
    },
    onError: (error: Error) => {
      message.error(error.message || "Erro ao criar coleta");
    },
  });
}

export function useReagendarColeta() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateColetaInput }) =>
      updateColeta(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: coletasKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({
        queryKey: coletasKeys.lists(),
      });

      // Optimistically update
      queryClient.setQueriesData<ColetaListResponse>(
        { queryKey: coletasKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((coleta) =>
              coleta.id === id
                ? {
                    ...coleta,
                    scheduledFor: data.scheduledFor,
                    status: "reagendada" as const,
                    updatedAt: new Date().toISOString(),
                  }
                : coleta
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      message.error(error.message || "Erro ao reagendar coleta");
    },
    onSuccess: () => {
      message.success("Coleta reagendada com sucesso");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: coletasKeys.lists() });
    },
  });
}

export function useDeleteColeta() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: deleteColeta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coletasKeys.lists() });
      message.success("Coleta cancelada com sucesso");
    },
    onError: (error: Error) => {
      message.error(error.message || "Erro ao cancelar coleta");
    },
  });
}
