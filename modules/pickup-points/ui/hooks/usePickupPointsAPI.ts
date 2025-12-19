'use client';

import { useState, useCallback } from 'react';
import type { PickupPoint, PickupPointFormData, PickupPointFilters, PickupPointListResponse } from '@/modules/pickup-points/application/types';

export function usePickupPointsAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = useCallback(async (filters?: PickupPointFilters): Promise<PickupPointListResponse> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (filters?.status && filters.status !== 'all') {
        params.set('status', filters.status);
      }
      if (filters?.uf) {
        params.set('uf', filters.uf);
      }
      if (filters?.cidade) {
        params.set('cidade', filters.cidade);
      }
      if (filters?.q) {
        params.set('q', filters.q);
      }
      if (filters?.page) {
        params.set('page', filters.page.toString());
      }
      if (filters?.pageSize) {
        params.set('pageSize', filters.pageSize.toString());
      }

      const response = await fetch(`/api/admin/pickup-points?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao buscar pontos');
      }

      const json = await response.json();
      const data = json.data ?? json;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPoint = useCallback(async (id: string): Promise<PickupPoint> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pickup-points/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao buscar ponto');
      }

      const json = await response.json();
      const data = json.data ?? json;
      return data.point;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createPoint = useCallback(async (formData: PickupPointFormData): Promise<PickupPoint> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/pickup-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao criar ponto');
      }

      const json = await response.json();
      const payload = json.data ?? json;
      return payload.point;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePoint = useCallback(async (id: string, formData: Partial<PickupPointFormData>): Promise<PickupPoint> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pickup-points/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao atualizar ponto');
      }

      const json = await response.json();
      const payload = json.data ?? json;
      return payload.point;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePoint = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pickup-points/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao excluir ponto');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleStatus = useCallback(async (id: string): Promise<PickupPoint> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pickup-points/${id}/status`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao atualizar status');
      }

      const json = await response.json();
      const data = json.data ?? json;
      return data.point;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchPoints,
    fetchPoint,
    createPoint,
    updatePoint,
    deletePoint,
    toggleStatus,
  };
}
