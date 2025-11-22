"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchCepV2, normalizeCep, isValidCep, type CepResponse, type CepError } from "@/lib/services/brasilapi";

export type CepLookupState = {
  isLoading: boolean;
  data: CepResponse | null;
  error: CepError | null;
};

export type CepLookupCallbacks = {
  onSuccess?: (data: CepResponse) => void;
  onError?: (error: CepError) => void;
};

/**
 * Hook para consulta de CEP com debounce
 * @param cep - CEP a ser consultado
 * @param callbacks - Callbacks opcionais para sucesso/erro
 * @param debounceMs - Tempo de debounce em ms (padrão: 400ms)
 * @returns Estado da consulta
 */
export function useCepLookup(
  cep: string,
  callbacks?: CepLookupCallbacks,
  debounceMs: number = 400
): CepLookupState {
  const [state, setState] = useState<CepLookupState>({
    isLoading: false,
    data: null,
    error: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const lookup = useCallback(async (cepValue: string) => {
    const normalized = normalizeCep(cepValue);

    // Não consulta se não tiver 8 dígitos
    if (!isValidCep(normalized)) {
      setState({
        isLoading: false,
        data: null,
        error: null,
      });
      return;
    }

    // Cancela requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const data = await fetchCepV2(normalized);

      setState({
        isLoading: false,
        data,
        error: null,
      });

      callbacks?.onSuccess?.(data);
    } catch (error) {
      const cepError = error as CepError;

      setState({
        isLoading: false,
        data: null,
        error: cepError,
      });

      callbacks?.onError?.(cepError);
    }
  }, [callbacks]);

  useEffect(() => {
    // Limpa timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Limpa estado se CEP estiver vazio
    if (!cep) {
      setState({
        isLoading: false,
        data: null,
        error: null,
      });
      return;
    }

    const normalized = normalizeCep(cep);

    // Só aplica debounce se tiver 8 dígitos
    if (isValidCep(normalized)) {
      timeoutRef.current = setTimeout(() => {
        lookup(cep);
      }, debounceMs);
    } else {
      // Menos de 8 dígitos - limpa estado
      setState({
        isLoading: false,
        data: null,
        error: null,
      });
    }

    // Capture the controller at effect execution time for cleanup
    const controller = abortControllerRef.current;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (controller) {
        controller.abort();
      }
    };
  }, [cep, debounceMs, lookup]);

  return state;
}
