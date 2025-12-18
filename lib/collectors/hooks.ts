import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageInstance } from '@/lib/ui/useAppMessage';
import type {
  Collector,
  CollectorFilters,
  CollectorFormData,
  CollectorListResponse,
} from './types';
import { qk } from './queryKeys';
import { uploadFile } from './upload';
import { unmaskDigits } from './masks';

function serializeParams(params?: CollectorFilters): string {
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

function normalizePayload(data: CollectorFormData): CollectorFormData {
  const payload: CollectorFormData = {
    ...data,
    pf: {
      ...data.pf,
      cpf: unmaskDigits(data.pf.cpf),
      cnh: {
        ...data.pf.cnh,
        number: unmaskDigits(data.pf.cnh.number),
        category: data.pf.cnh.category as 'ACC' | 'A' | 'B' | 'C' | 'D' | 'E',
      },
      endereco: {
        ...data.pf.endereco,
        cep: data.pf.endereco.cep ? unmaskDigits(data.pf.endereco.cep) : null,
        uf: data.pf.endereco.uf ? data.pf.endereco.uf.toUpperCase() : null,
      },
      celular: unmaskDigits(data.pf.celular),
      whatsapp: data.pf.whatsapp ? unmaskDigits(data.pf.whatsapp) : null,
    },
    pj: {
      ...data.pj,
      cnpj: unmaskDigits(data.pj.cnpj),
      endereco: {
        ...data.pj.endereco,
        cep: data.pj.endereco.cep ? unmaskDigits(data.pj.endereco.cep) : null,
        uf: data.pj.endereco.uf ? data.pj.endereco.uf.toUpperCase() : null,
      },
    },
    vehicle: {
      ...data.vehicle,
      plate: data.vehicle.plate.toUpperCase(),
    },
    commission: data.commission.kind === 'fixa'
      ? { kind: 'fixa', amount: Number(data.commission.amount) }
      : { kind: 'porKm', amountPerKm: Number(data.commission.amountPerKm) },
    bank: data.bank.kind === 'pix'
      ? {
          kind: 'pix',
          pixType: data.bank.pixType,
          pixKey:
            data.bank.pixType === 'cpf' || data.bank.pixType === 'cnpj' || data.bank.pixType === 'phone'
              ? unmaskDigits(data.bank.pixKey)
              : data.bank.pixKey,
        }
      : {
          kind: 'transfer',
          bankCode: data.bank.bankCode,
          branch: data.bank.branch,
          account: data.bank.account,
          accountType: data.bank.accountType,
          holderName: data.bank.holderName,
          holderCnpj: unmaskDigits(data.bank.holderCnpj),
        },
  };

  return payload;
}

export function useCollectors(params?: CollectorFilters) {
  const searchParams = new URLSearchParams();

  if (params?.q) searchParams.set('q', params.q);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.uf) searchParams.set('uf', params.uf);
  if (params?.cidade) searchParams.set('cidade', params.cidade);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params?.sort) searchParams.set('sort', params.sort);

  return useQuery({
    queryKey: qk.list(serializeParams(params)),
    queryFn: async (): Promise<CollectorListResponse> => {
      const suffix = searchParams.toString();
      const url = `/api/admin/coletores${suffix ? `?${suffix}` : ''}`;
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar coletores');
      const json = await res.json();
      return (json.data ?? json) as CollectorListResponse;
    },
  });
}

export function useCollector(id: string | null) {
  return useQuery({
    queryKey: qk.one(id || ''),
    queryFn: async (): Promise<Collector> => {
      const res = await fetch(`/api/admin/coletores/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar coletor');
      const data = await res.json();
      return data.collector || data;
    },
    enabled: !!id,
  });
}

export function useCreateCollector(messageApi?: MessageInstance) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CollectorFormData): Promise<Collector> => {
      const res = await fetch('/api/admin/coletores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(normalizePayload(data)),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar coletor');
      }

      const result = await res.json();
      return result.collector || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectors.list'] });
      messageApi?.success('Coletor criado com sucesso');
    },
    onError: (error: Error) => {
      messageApi?.error(error.message);
    },
  });
}

export function useUpdateCollector(messageApi?: MessageInstance) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CollectorFormData }): Promise<Collector> => {
      const res = await fetch(`/api/admin/coletores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(normalizePayload(data)),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar coletor');
      }

      const result = await res.json();
      return result.collector || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectors.list'] });
      messageApi?.success('Coletor atualizado com sucesso');
    },
    onError: (error: Error) => {
      messageApi?.error(error.message);
    },
  });
}

export function useDeleteCollector(messageApi?: MessageInstance) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/admin/coletores/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao excluir coletor');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectors.list'] });
      messageApi?.success('Coletor excluído com sucesso');
    },
    onError: (error: Error) => {
      messageApi?.error(error.message);
    },
  });
}

export function useToggleCollectorStatus(messageApi?: MessageInstance) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'blocked' }): Promise<Collector> => {
      const res = await fetch(`/api/admin/coletores/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar status');
      }

      const result = await res.json();
      return result.collector || result;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['collectors.list'] });

      const previous = queryClient.getQueriesData({ queryKey: ['collectors.list'] });

      queryClient.setQueriesData(
        { queryKey: ['collectors.list'] },
        (old: CollectorListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((collector) =>
              collector.id === id
                ? { ...collector, status, updatedAt: new Date().toISOString() }
                : collector
            ),
          };
        }
      );

      return { previous };
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['collectors.list'] });
      messageApi?.success(status === 'active' ? 'Coletor ativado' : 'Coletor bloqueado');
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        context.previous.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      messageApi?.error(error.message);
    },
  });
}

export function useUpload() {
  return useCallback(async (file: File, documentType?: string) => uploadFile(file, documentType), []);
}
