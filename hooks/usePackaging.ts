import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PackagingCreateInput } from '@/lib/validation/packaging';

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
    queryFn: async () => {
      const response = await fetch('/api/packaging');

      if (!response.ok) {
        throw new Error('Erro ao buscar embalagens');
      }

      const data: PackagingTemplate[] = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para criar uma nova embalagem
 */
export function useCreatePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PackagingCreateInput) => {
      const response = await fetch('/api/packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar embalagem');
      }

      const result: PackagingTemplate = await response.json();
      return result;
    },
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<PackagingCreateInput> }) => {
      const response = await fetch(`/api/packaging/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao atualizar embalagem');
      }

      const result: PackagingTemplate = await response.json();
      return result;
    },
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
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/packaging/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao remover embalagem');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging'] });
    },
  });
}
