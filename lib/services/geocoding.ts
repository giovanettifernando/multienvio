/**
 * Serviço de geocodificação
 * Converte CEP/endereço em coordenadas geográficas (lat/lng)
 */

import type { GeoCoordinates } from '@/lib/utils/geo';

interface GeocodingResult {
  success: boolean;
  coordinates?: GeoCoordinates;
  error?: string;
}

/**
 * Cache simples em memória para evitar geocodificar o mesmo CEP múltiplas vezes
 */
const geocodingCache = new Map<string, GeoCoordinates>();

/**
 * Geocodifica um CEP usando BrasilAPI
 * @param cep CEP formatado (com ou sem hífen)
 * @returns Coordenadas ou undefined se falhar
 */
export async function geocodeCEP(cep: string): Promise<GeocodingResult> {
  const cleanCep = cep.replace(/\D/g, '');

  if (cleanCep.length !== 8) {
    return {
      success: false,
      error: 'CEP inválido',
    };
  }

  // Verificar cache
  const cacheKey = cleanCep;
  if (geocodingCache.has(cacheKey)) {
    return {
      success: true,
      coordinates: geocodingCache.get(cacheKey)!,
    };
  }

  try {
    // 1. Buscar informações do CEP na BrasilAPI
    const cepResponse = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, {
      signal: AbortSignal.timeout(5000), // 5 segundos de timeout
    });

    if (!cepResponse.ok) {
      return {
        success: false,
        error: `CEP não encontrado (status ${cepResponse.status})`,
      };
    }

    const cepData = await cepResponse.json();

    // 2. Montar endereço completo para geocodificação
    const addressParts = [
      cepData.street,
      cepData.neighborhood,
      cepData.city,
      cepData.state,
      'Brazil',
    ].filter(Boolean);

    const address = addressParts.join(', ');

    // 3. Geocodificar usando Nominatim (OpenStreetMap)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Envio Legal App',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!nominatimResponse.ok) {
      return {
        success: false,
        error: 'Erro ao geocodificar endereço',
      };
    }

    const nominatimData = await nominatimResponse.json();

    if (!nominatimData || nominatimData.length === 0) {
      // Fallback: tentar apenas com cidade/estado
      const simplifiedAddress = `${cepData.city}, ${cepData.state}, Brazil`;
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplifiedAddress)}&limit=1`;

      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Envio Legal App',
        },
        signal: AbortSignal.timeout(5000),
      });

      const fallbackData = await fallbackResponse.json();

      if (!fallbackData || fallbackData.length === 0) {
        return {
          success: false,
          error: 'Não foi possível geocodificar o endereço',
        };
      }

      const coordinates: GeoCoordinates = {
        lat: parseFloat(fallbackData[0].lat),
        lng: parseFloat(fallbackData[0].lon),
      };

      // Salvar no cache
      geocodingCache.set(cacheKey, coordinates);

      return {
        success: true,
        coordinates,
      };
    }

    const coordinates: GeoCoordinates = {
      lat: parseFloat(nominatimData[0].lat),
      lng: parseFloat(nominatimData[0].lon),
    };

    // Salvar no cache
    geocodingCache.set(cacheKey, coordinates);

    return {
      success: true,
      coordinates,
    };
  } catch (error) {
    console.error('[geocodeCEP] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Geocodifica um endereço completo
 * @param address Objeto com dados do endereço
 * @returns Coordenadas ou undefined se falhar
 */
export async function geocodeAddress(address: {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}): Promise<GeocodingResult> {
  // Se tiver CEP, usar ele como prioridade
  if (address.cep) {
    const cepResult = await geocodeCEP(address.cep);
    if (cepResult.success) {
      return cepResult;
    }
  }

  // Fallback: tentar com endereço completo
  const addressParts = [
    address.logradouro,
    address.numero,
    address.bairro,
    address.cidade,
    address.uf,
    'Brazil',
  ].filter(Boolean);

  if (addressParts.length < 2) {
    return {
      success: false,
      error: 'Endereço insuficiente para geocodificação',
    };
  }

  const fullAddress = addressParts.join(', ');

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Envio Legal App',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Erro ao geocodificar endereço',
      };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Endereço não encontrado',
      };
    }

    const coordinates: GeoCoordinates = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };

    return {
      success: true,
      coordinates,
    };
  } catch (error) {
    console.error('[geocodeAddress] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
