/**
 * Query keys para React Query - Coletas
 */

export const coletasKeys = {
  all: ["coletas"] as const,
  lists: () => [...coletasKeys.all, "list"] as const,
  list: (params?: string) => [...coletasKeys.lists(), params ?? "all"] as const,
  details: () => [...coletasKeys.all, "detail"] as const,
  detail: (id: string) => [...coletasKeys.details(), id] as const,
};
