/**
 * Hook para buscar marcas e modelos de veículos FIPE
 */

import { useState, useEffect, useCallback } from 'react';

export interface FipeBrand {
  id: string;
  fipeCode: string;
  name: string;
}

export interface FipeModel {
  id: string;
  fipeCode: string;
  name: string;
}

export type FipeVehicleType = 'cars' | 'motorcycles' | 'trucks';

interface UseFipeBrandsOptions {
  vehicleType?: FipeVehicleType;
  enabled?: boolean;
}

interface UseFipeModelsOptions {
  brandId: string | null;
  enabled?: boolean;
}

/**
 * Hook para buscar marcas FIPE
 */
export function useFipeBrands(options: UseFipeBrandsOptions = {}) {
  const { vehicleType = 'cars', enabled = true } = options;
  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/fipe/brands?vehicleType=${vehicleType}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar marcas');
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      const data = json.data ?? json;
      setBrands(data.brands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleType, enabled]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return { brands, loading, error, refetch: fetchBrands };
}

/**
 * Hook para buscar modelos FIPE de uma marca
 */
export function useFipeModels(options: UseFipeModelsOptions) {
  const { brandId, enabled = true } = options;
  const [models, setModels] = useState<FipeModel[]>([]);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    if (!enabled || !brandId) {
      setModels([]);
      setBrandName(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/fipe/models?brandId=${brandId}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar modelos');
      }
      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      const data = json.data ?? json;
      setModels(data.models || []);
      setBrandName(data.brand || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [brandId, enabled]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, brandName, loading, error, refetch: fetchModels };
}

/**
 * Hook combinado para selects de marca e modelo
 */
export function useFipeVehicleSelects(vehicleType: FipeVehicleType = 'cars') {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  const { brands, loading: brandsLoading } = useFipeBrands({ vehicleType });
  const { models, loading: modelsLoading } = useFipeModels({
    brandId: selectedBrandId,
    enabled: !!selectedBrandId,
  });

  const brandOptions = brands.map((brand) => ({
    value: brand.id,
    label: brand.name,
  }));

  const modelOptions = models.map((model) => ({
    value: model.id,
    label: model.name,
  }));

  const handleBrandChange = (brandId: string | null) => {
    setSelectedBrandId(brandId);
  };

  // Encontrar nome da marca selecionada
  const selectedBrandName = brands.find((b) => b.id === selectedBrandId)?.name || null;

  return {
    brands,
    models,
    brandOptions,
    modelOptions,
    selectedBrandId,
    selectedBrandName,
    brandsLoading,
    modelsLoading,
    handleBrandChange,
  };
}
