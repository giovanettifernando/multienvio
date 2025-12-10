import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  audience: 'USER' | 'COLLECTOR';
  sortOrder: number;
  isActive: boolean;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface FAQListResponse {
  items: FAQItem[];
  total: number;
  categories: string[];
}

interface UseFAQOptions {
  audience?: 'USER' | 'COLLECTOR';
  category?: string;
  search?: string;
  enabled?: boolean;
}

/**
 * Hook para buscar FAQs públicas
 */
export function useFAQ(options: UseFAQOptions = {}) {
  const { audience = 'USER', category, search, enabled = true } = options;

  return useQuery<FAQListResponse>({
    queryKey: ['faq', audience, category, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('audience', audience);
      if (category) params.set('category', category);
      if (search) params.set('q', search);

      const response = await fetch(`/api/faq?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar FAQ');
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as FAQListResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos - FAQ não muda com frequência
  });
}

/**
 * Hook para enviar feedback de FAQ ("Isso foi útil?")
 */
export function useFAQFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const response = await fetch(`/api/faq/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });

      if (!response.ok) {
        const errorJson = await response.json();
        const error = errorJson.error ?? errorJson;
        throw new Error(error.error || error.message || 'Falha ao enviar feedback');
      }

      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return json.data ?? json;
    },
    onSuccess: () => {
      // Invalidar cache de FAQ após feedback
      queryClient.invalidateQueries({ queryKey: ['faq'] });
    },
  });
}

/**
 * Hook para registrar visualização de FAQ
 */
export function useFAQView() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/faq/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: true }),
      });

      if (!response.ok) {
        // Silencioso - não queremos erros de visualização afetando UX
        return null;
      }

      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return json.data ?? json;
    },
  });
}
