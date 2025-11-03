"use client";

import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  type NewTicketInput,
  type Priority,
  type Status,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/validation/support";

type Audience = "user" | "admin" | "collector";

type TicketFilters = {
  status?: Status[];
  priority?: Priority[];
  query?: string;
  requesterEmail?: string;
  assignedTo?: string | null;
};

type TicketsQueryOptions = {
  audience?: Audience;
  filters?: TicketFilters;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
};

type TicketsQueryResult = {
  tickets: SupportTicket[];
  total?: number;
  page?: number;
  pageSize?: number;
};

type PostMessageInput = {
  ticketId: string;
  text: string;
  attachments?: File[];
  internal?: boolean;
};

function buildQueryParams({ filters, page, pageSize }: Omit<TicketsQueryOptions, "audience">) {
  const params = new URLSearchParams();

  if (filters?.query) {
    params.set("q", filters.query);
  }

  if (filters?.status?.length) {
    filters.status.forEach((value) => params.append("status", value));
  }

  if (filters?.priority?.length) {
    filters.priority.forEach((value) => params.append("priority", value));
  }

  if (filters?.requesterEmail) {
    params.set("requesterEmail", filters.requesterEmail);
  }

  if (filters?.assignedTo !== undefined) {
    params.set("assignedTo", filters.assignedTo === null ? "null" : filters.assignedTo);
  }

  if (page) {
    params.set("page", String(page));
  }

  if (pageSize) {
    params.set("pageSize", String(pageSize));
  }

  return params;
}

function getTicketsEndpoint(audience: Audience): string {
  if (audience === "admin") return "/api/admin/support/tickets";
  if (audience === "collector") return "/api/collector/tickets";
  return "/api/support/tickets";
}

function getTicketEndpoint(audience: Audience, ticketId: string): string {
  const base = getTicketsEndpoint(audience);
  return `${base}/${ticketId}`;
}

function getMessageEndpoint(audience: Audience, ticketId: string): string {
  if (audience === "admin") {
    return `/api/admin/support/tickets/${ticketId}/reply`;
  }
  if (audience === "collector") {
    return `/api/collector/tickets/${ticketId}/messages`;
  }
  return `/api/support/tickets/${ticketId}/messages`;
}

function getStatusEndpoint(ticketId: string): string {
  return `/api/admin/support/tickets/${ticketId}/status`;
}

function getAssignmentEndpoint(ticketId: string): string {
  return `/api/admin/support/tickets/${ticketId}/assign`;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const message =
      (body as Record<string, unknown> | undefined)?.message ??
      (body as Record<string, unknown> | undefined)?.mensagem ??
      "Operação não pôde ser concluída.";
    throw new Error(typeof message === "string" ? message : "Erro inesperado");
  }

  return response.json() as Promise<T>;
}

export function useTickets({
  audience = "user",
  filters,
  page,
  pageSize,
  enabled = true,
  refetchInterval,
  refetchOnWindowFocus,
}: TicketsQueryOptions = {}): UseQueryResult<TicketsQueryResult> {
  const params = useMemo(
    () => buildQueryParams({ filters, page, pageSize }),
    [filters, page, pageSize],
  );

  const serializedParams = useMemo(() => params.toString() || "all", [params]);
  const endpoint = useMemo(() => {
    const base = getTicketsEndpoint(audience);
    const suffix = params.toString();
    return suffix ? `${base}?${suffix}` : base;
  }, [audience, params]);

  const enableInterval = typeof refetchInterval === "number" && refetchInterval > 0;

  return useQuery({
    queryKey: ["supportTickets", audience, serializedParams],
    queryFn: async (): Promise<TicketsQueryResult> => {
      if (audience === "admin") {
        const data = await fetchJson<{
          items: SupportTicket[];
          total: number;
          page: number;
          pageSize: number;
        }>(endpoint);
        return {
          tickets: data.items ?? [],
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
        };
      }

      const data = await fetchJson<{ tickets: SupportTicket[] }>(endpoint);
      return {
        tickets: data.tickets ?? [],
      };
    },
    enabled,
    refetchInterval,
    refetchOnWindowFocus,
    refetchIntervalInBackground: enableInterval ? false : undefined,
  });
}

export function useTicket(
  ticketId: string | null,
  audience: Audience = "user",
  options: {
    enabled?: boolean;
    refetchInterval?: number | false;
    refetchOnWindowFocus?: boolean;
  } = {},
): UseQueryResult<SupportTicket> {
  const { enabled = true, refetchInterval, refetchOnWindowFocus } = options;
  const enableInterval = typeof refetchInterval === "number" && refetchInterval > 0;

  return useQuery({
    queryKey: ["supportTicket", audience, ticketId ?? "unknown"],
    queryFn: async () => {
      if (!ticketId) {
        throw new Error("Ticket inválido");
      }
      return fetchJson<SupportTicket>(getTicketEndpoint(audience, ticketId));
    },
    enabled: enabled && Boolean(ticketId),
    staleTime: 0,
    refetchInterval: ticketId ? refetchInterval : false,
    refetchOnWindowFocus,
    refetchIntervalInBackground: enableInterval ? false : undefined,
  });
}

export function useCreateTicket(audience: Audience = "user"): UseMutationResult<
  SupportTicket,
  Error,
  NewTicketInput,
  void
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewTicketInput) => {
      const endpoint = getTicketsEndpoint(audience);
      return fetchJson<SupportTicket>(endpoint, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["supportTickets"] });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "supportTicket",
      });
      // Prime individual ticket cache for immediate access
      queryClient.setQueryData(["supportTicket", audience, ticket.id], ticket);
    },
  });
}

export function usePostTicketMessage(audience: Audience = "user") {
  const queryClient = useQueryClient();

  return useMutation<SupportMessage, Error, PostMessageInput>({
    mutationFn: async ({ ticketId, text, attachments, internal }) => {
      const endpoint = getMessageEndpoint(audience, ticketId);
      const formData = new FormData();
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error("Mensagem obrigatória");
      }
      formData.append("text", trimmed);

      if (audience === "admin" && internal !== undefined) {
        formData.append("internal", internal ? "true" : "false");
      }

      (attachments ?? []).slice(0, 5).forEach((file) => {
        if (file instanceof File) {
          formData.append("files", file, file.name);
        }
      });

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        const errorMessage =
          (data as Record<string, unknown> | undefined)?.message ??
          "Não foi possível enviar a mensagem.";
        throw new Error(String(errorMessage));
      }

      return data as SupportMessage;
    },
    onSuccess: (_message, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["supportTicket", "user", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["supportTicket", "admin", ticketId] });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "supportTickets",
      });
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation<SupportTicket, Error, { ticketId: string; status: Status }>({
    mutationFn: async ({ ticketId, status }) => {
      return fetchJson<SupportTicket>(getStatusEndpoint(ticketId), {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "supportTickets",
      });
      queryClient.setQueryData(["supportTicket", "admin", ticket.id], ticket);
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation<
    SupportTicket,
    Error,
    { ticketId: string; assignedTo: string | null }
  >({
    mutationFn: async ({ ticketId, assignedTo }) => {
      return fetchJson<SupportTicket>(getAssignmentEndpoint(ticketId), {
        method: "PATCH",
        body: JSON.stringify({ assignedTo }),
      });
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "supportTickets",
      });
      queryClient.setQueryData(["supportTicket", "admin", ticket.id], ticket);
    },
  });
}
