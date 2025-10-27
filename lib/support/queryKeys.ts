export const qk = {
  tickets: (params?: string) => ["support.tickets", params ?? "all"] as const,
  ticket: (id: string) => ["support.ticket", id] as const,
};
