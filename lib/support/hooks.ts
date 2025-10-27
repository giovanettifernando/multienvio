import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TicketFilterInput, TicketReplyInput, TicketUpdateInput } from "./schemas";
import { ticketReplySchema, ticketUpdateSchema } from "./schemas";
import { qk } from "./queryKeys";
import type { SupportTicket } from "./types";

export interface TicketListParams extends TicketFilterInput {
  page?: number;
  pageSize?: number;
  viewerId?: string;
}

export interface TicketListResponse {
  items: SupportTicket[];
  total: number;
  page: number;
  pageSize: number;
}

function buildSearchParams(params?: TicketListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (!params) return searchParams;

  if (params.q) searchParams.set("q", params.q);
  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }
  if (params.category && params.category !== "all") {
    searchParams.set("category", params.category);
  }
  if (params.assignee && params.assignee !== "all") {
    searchParams.set("assignee", params.assignee);
  }
  if (params.viewerId) {
    searchParams.set("viewerId", params.viewerId);
  }
  if (params.page && params.page > 1) {
    searchParams.set("page", params.page.toString());
  }
  if (params.pageSize && params.pageSize !== 10) {
    searchParams.set("pageSize", params.pageSize.toString());
  }

  return searchParams;
}

function serializeParams(params?: TicketListParams): string {
  const searchParams = buildSearchParams(params);
  return searchParams.toString() || "all";
}

export function useTickets(params?: TicketListParams) {
  const searchParams = useMemo(() => buildSearchParams(params), [params]);
  const serialized = useMemo(() => serializeParams(params), [params]);

  return useQuery({
    queryKey: qk.tickets(serialized),
    queryFn: async (): Promise<TicketListResponse> => {
      const queryString = searchParams.toString();
      const url = `/api/mock/support/tickets${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível carregar os tickets.");
      }
      const data = (await res.json()) as TicketListResponse;
      return data;
    },
  });
}

export function useTicket(id?: string) {
  return useQuery({
    queryKey: qk.ticket(id ?? "unknown"),
    queryFn: async (): Promise<SupportTicket> => {
      const res = await fetch(`/api/mock/support/tickets/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível carregar o ticket.");
      }
      const data = (await res.json()) as SupportTicket;
      return data;
    },
    enabled: Boolean(id),
  });
}

type UpdatePayload = {
  id: string;
  data: TicketUpdateInput;
};

type TicketListCacheEntry = [readonly unknown[], TicketListResponse | undefined];

type UpdateContext = {
  previousTicket?: SupportTicket;
  previousLists: TicketListCacheEntry[];
};

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation<SupportTicket, Error, UpdatePayload, UpdateContext>({
    mutationFn: async ({ id, data }) => {
      const payload = ticketUpdateSchema.parse(data);
      const res = await fetch(`/api/mock/support/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível atualizar o ticket.");
      }
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: qk.ticket(id) });
      await queryClient.cancelQueries({ queryKey: ["support.tickets"] });

      const previousTicket = queryClient.getQueryData<SupportTicket>(qk.ticket(id));
      const previousLists = queryClient.getQueriesData<TicketListResponse>({
        queryKey: ["support.tickets"],
      });

      if (previousTicket) {
        const nextTicket: SupportTicket = {
          ...previousTicket,
          status: data.status ?? previousTicket.status,
          category: data.category ?? previousTicket.category,
          assigneeUserId:
            data.assigneeUserId !== undefined ? data.assigneeUserId : previousTicket.assigneeUserId,
        };
        queryClient.setQueryData(qk.ticket(id), nextTicket);
      }

      previousLists.forEach(([key, list]) => {
        if (!list) return;
        const updatedItems = list.items.map((ticket) => {
          if (ticket.id !== id) return ticket;
          return {
            ...ticket,
            status: data.status ?? ticket.status,
            category: data.category ?? ticket.category,
            assigneeUserId:
              data.assigneeUserId !== undefined ? data.assigneeUserId : ticket.assigneeUserId,
          };
        });
        queryClient.setQueryData<TicketListResponse>(key, {
          ...list,
          items: updatedItems,
        });
      });

      return { previousTicket, previousLists };
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(qk.ticket(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: ["support.tickets"] });
    },
    onError: (_error, { id }, context) => {
      if (context?.previousTicket) {
        queryClient.setQueryData(qk.ticket(id), context.previousTicket);
      }
      context?.previousLists.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
  });
}

type ReplyPayload = {
  id: string;
  data: TicketReplyInput;
};

export function useReplyTicket() {
  const queryClient = useQueryClient();

  return useMutation<SupportTicket, Error, ReplyPayload>({
    mutationFn: async ({ id, data }) => {
      const payload = ticketReplySchema.parse(data);
      const res = await fetch(`/api/mock/support/tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível enviar a resposta.");
      }
      const json = (await res.json()) as { ticket: SupportTicket };
      return json.ticket;
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(qk.ticket(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: ["support.tickets"] });
    },
  });
}
