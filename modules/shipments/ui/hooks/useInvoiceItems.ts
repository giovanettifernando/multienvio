import { useState, useCallback } from 'react';
import type { InvoiceData, ParseXmlResponse } from '@/shared/types/invoice';

interface UseInvoiceItemsReturn {
  data: InvoiceData | null;
  loading: boolean;
  error: string | null;
  parseXml: (xml: string) => Promise<void>;
  reset: () => void;
}

export function useInvoiceItems(): UseInvoiceItemsReturn {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseXml = useCallback(async (xml: string) => {
    if (!xml) {
      setError('XML não fornecido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/nfe/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ xml }),
      });

      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      const result: ParseXmlResponse = json.data ?? json;

      if (!result.success || !result.data) {
        throw new Error(result.error || json.error?.message || 'Erro ao processar XML');
      }

      setData(result.data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar XML da NF-e';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    parseXml,
    reset,
  };
}
