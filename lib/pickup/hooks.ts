import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import type { PickupPoint, PickupPointFilters, PickupPointListResponse, PickupPointFormData } from './types';
import { qk } from './queryKeys';

// Serializa params para a query key
function serializeParams(params?: PickupPointFilters): string {
  if (!params) return 'all';
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  if (params.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params.uf) searchParams.set('uf', params.uf);
  if (params.cidade) searchParams.set('cidade', params.cidade);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.sort) searchParams.set('sort', params.sort);

  return searchParams.toString() || 'all';
}

// ========== QUERY HOOKS ==========

export function usePoints(params?: PickupPointFilters) {
  const searchParams = new URLSearchParams();

  if (params?.q) searchParams.set('q', params.q);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.uf) searchParams.set('uf', params.uf);
  if (params?.cidade) searchParams.set('cidade', params.cidade);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params?.sort) searchParams.set('sort', params.sort);

  return useQuery({
    queryKey: qk.points(serializeParams(params)),
    queryFn: async (): Promise<PickupPointListResponse> => {
      const url = `/api/mock/pickup/points${searchParams.toString() ? `?${searchParams}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar pontos de coleta');
      return res.json();
    },
  });
}

export function usePoint(id: string | null) {
  return useQuery({
    queryKey: qk.point(id || ''),
    queryFn: async (): Promise<PickupPoint> => {
      const res = await fetch(`/api/mock/pickup/points/${id}`);
      if (!res.ok) throw new Error('Erro ao carregar ponto de coleta');
      return res.json();
    },
    enabled: !!id,
  });
}

// ========== MUTATION HOOKS ==========

export function useCreatePoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PickupPointFormData): Promise<PickupPoint> => {
      const res = await fetch('/api/mock/pickup/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar ponto de coleta');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup.points'] });
      message.success('Ponto de coleta criado com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useUpdatePoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PickupPointFormData }): Promise<PickupPoint> => {
      const res = await fetch(`/api/mock/pickup/points/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar ponto de coleta');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup.points'] });
      message.success('Ponto de coleta atualizado com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useDeletePoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/mock/pickup/points/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao excluir ponto de coleta');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup.points'] });
      message.success('Ponto de coleta excluído com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useToggleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'blocked' }): Promise<PickupPoint> => {
      const res = await fetch(`/api/mock/pickup/points/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar status');
      }

      return res.json();
    },
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['pickup.points'] });

      // Snapshot previous values
      const previousData = queryClient.getQueriesData({ queryKey: ['pickup.points'] });

      // Optimistically update all queries
      queryClient.setQueriesData(
        { queryKey: ['pickup.points'] },
        (old: PickupPointListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((point) =>
              point.id === id ? { ...point, status, updatedAt: new Date().toISOString() } : point
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['pickup.points'] });
      message.success(status === 'active' ? 'Ponto de coleta ativado' : 'Ponto de coleta bloqueado');
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      message.error(error.message);
    },
  });
}
