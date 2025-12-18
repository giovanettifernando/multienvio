import { useState, useCallback } from "react";

interface RecurringItem {
  id: string;
  descricao: string;
  valorUnitario: number;
}

export function useRecurringItemsAutocomplete() {
  const [suggestions, setSuggestions] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(false);

  const searchItems = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/recurring-items/search?q=${encodeURIComponent(query)}`
      );

      if (response.ok) {
        const result = await response.json();
        setSuggestions(result.data);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Erro ao buscar itens recorrentes:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    suggestions,
    loading,
    searchItems,
  };
}
