export const qk = {
  points: (params?: string) => ['pickup.points', params ?? 'all'] as const,
  point: (id: string) => ['pickup.point', id] as const,
};
