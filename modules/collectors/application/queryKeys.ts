export const qk = {
  list: (params?: string) => ['collectors.list', params ?? 'all'] as const,
  one: (id: string) => ['collectors.one', id] as const,
};
