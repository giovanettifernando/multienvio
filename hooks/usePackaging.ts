import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PackagingCreateInput } from '@/lib/validation/packaging';
import { apiFetch } from '@/lib/api/client';

export interface PackagingTemplate {
  id: string;
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook para listar embalagens do usuário
 */
export function useListPackaging() {
  return useQuery({
    queryKey: ['packaging'],
    queryFn: () => apiFetch<PackagingTemplate[]>('/api/packaging'),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para criar uma nova embalagem
 */
export function useCreatePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PackagingCreateInput) =>
      apiFetch<PackagingTemplate>('/api/packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidar cache para forçar refetch
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
    },
  });
}

/**
 * Hook para atualizar uma embalagem (opcional - para uso futuro)
 */
export function useUpdatePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PackagingCreateInput> }) =>
      apiFetch<PackagingTemplate>(`/api/packaging/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
    },
  });
}

/**
 * Hook para remover uma embalagem (opcional - para uso futuro)
 */
export function useDeletePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/packaging/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
    },
  });
}
