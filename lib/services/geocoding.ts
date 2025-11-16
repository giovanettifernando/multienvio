/**
 * Serviço de geocodificação com estratégia de precisão em múltiplas camadas
 *
 * Estratégia de geocodificação (em ordem de tentativa):
 * 1. TENTATIVA A - Endereço completo (rua + bairro + cidade + estado) → precision: 'address'
 * 2. TENTATIVA B - CEP isolado com cidade/estado → precision: 'zipcode'
 * 3. TENTATIVA C - Cidade + estado → precision: 'city'
 * 4. TENTATIVA D - Capital do estado (fallback forte) → precision: 'state_fallback'
 */

import type { GeoCoordinates } from '@/lib/utils/geo';
import { getUFCoordinates } from '@/lib/utils/geo';

/**
 * Tipos de precisão de geocodificação (do mais preciso ao menos preciso)
 */
export type GeocodingPrecision =
  | 'address'       // Endereço completo (rua + bairro + cidade)
  | 'zipcode'       // CEP específico isolado
  | 'city'          // Cidade apenas
  | 'city_fallback' // Cidade (fallback após tentativas anteriores falharem)
  | 'state_fallback'; // Capital do estado (último recurso)

export interface GeocodingResult {
  success: boolean;
  coordinates?: GeoCoordinates;
  precision?: GeocodingPrecision;
  provider?: string;
  error?: string;
}

/**
 * Detalhes do endereço obtidos da BrasilAPI
 */
export interface AddressDetails {
  street?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
}

/**
 * Cache simples em memória para evitar geocodificar o mesmo CEP múltiplas vezes
 */
const geocodingCache = new Map<string, { coordinates: GeoCoordinates; precision: GeocodingPrecision; provider: string }>();

/**
 * Faz fetch com retry automático
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Se não for o último attempt, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Geocodifica um CEP usando estratégia de precisão em múltiplas camadas
 *
 * @param cep CEP formatado (com ou sem hífen)
 * @param addressDetails Detalhes do endereço (opcional, se já foram obtidos da BrasilAPI)
 * @returns Resultado com coordenadas, precisão e provider
 */
export async function geocodeCEP(
  cep: string,
  addressDetails?: AddressDetails
): Promise<GeocodingResult> {
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
    const cached = geocodingCache.get(cacheKey)!;
    return {
      success: true,
      coordinates: cached.coordinates,
      precision: cached.precision,
      provider: cached.provider,
    };
  }

  try {
    // 1. Buscar informações do CEP na BrasilAPI (se ainda não foram fornecidas)
    let cepData: AddressDetails;

    if (addressDetails) {
      cepData = addressDetails;
    } else {
      const cepResponse = await fetchWithRetry(
        `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
        {
          signal: AbortSignal.timeout(10000), // 10 segundos de timeout
        },
        1 // 1 retry
      );

      if (!cepResponse.ok) {
        return {
          success: false,
          error: `CEP não encontrado (status ${cepResponse.status})`,
        };
      }

      const rawData = await cepResponse.json();
      cepData = {
        street: rawData.street,
        neighborhood: rawData.neighborhood,
        city: rawData.city,
        state: rawData.state,
      };
    }

    // ============================================================
    // TENTATIVA A - Endereço completo (mais preciso)
    // ============================================================
    if (cepData.street && cepData.neighborhood) {
      try {
        const addressParts = [
          cepData.street,
          cepData.neighborhood,
          cepData.city,
          cepData.state,
          'Brazil',
        ].filter(Boolean);

        const fullAddress = addressParts.join(', ');
        console.log(`[geocodeCEP] TENTATIVA A - Endereço completo: ${fullAddress}`);

        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;

        const nominatimResponse = await fetchWithRetry(
          nominatimUrl,
          {
            headers: {
              'User-Agent': 'Envio Legal App',
            },
            signal: AbortSignal.timeout(8000),
          },
          0 // Sem retry para economizar tempo
        );

        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();

          if (nominatimData && nominatimData.length > 0) {
            const coordinates: GeoCoordinates = {
              lat: parseFloat(nominatimData[0].lat),
              lng: parseFloat(nominatimData[0].lon),
            };

            console.log(`[geocodeCEP] ✅ TENTATIVA A bem-sucedida (address):`, coordinates);
            geocodingCache.set(cacheKey, { coordinates, precision: 'address', provider: 'nominatim' });

            return {
              success: true,
              coordinates,
              precision: 'address',
              provider: 'nominatim',
            };
          }
        }
      } catch (error) {
        console.warn('[geocodeCEP] TENTATIVA A falhou, tentando B...', error);
      }
    }

    // ============================================================
    // TENTATIVA B - CEP isolado com cidade/estado
    // ============================================================
    try {
      const zipcodeParts = [
        cleanCep,
        cepData.city,
        cepData.state,
        'Brazil',
      ];

      const zipcodeQuery = zipcodeParts.join(', ');
      console.log(`[geocodeCEP] TENTATIVA B - CEP isolado: ${zipcodeQuery}`);

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipcodeQuery)}&limit=1`;

      const nominatimResponse = await fetchWithRetry(
        nominatimUrl,
        {
          headers: {
            'User-Agent': 'Envio Legal App',
          },
          signal: AbortSignal.timeout(8000),
        },
        0
      );

      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();

        if (nominatimData && nominatimData.length > 0) {
          const coordinates: GeoCoordinates = {
            lat: parseFloat(nominatimData[0].lat),
            lng: parseFloat(nominatimData[0].lon),
          };

          console.log(`[geocodeCEP] ✅ TENTATIVA B bem-sucedida (zipcode):`, coordinates);
          geocodingCache.set(cacheKey, { coordinates, precision: 'zipcode', provider: 'nominatim' });

          return {
            success: true,
            coordinates,
            precision: 'zipcode',
            provider: 'nominatim',
          };
        }
      }
    } catch (error) {
      console.warn('[geocodeCEP] TENTATIVA B falhou, tentando C...', error);
    }

    // ============================================================
    // TENTATIVA C - Cidade + estado (fallback moderado)
    // ============================================================
    try {
      const cityQuery = `${cepData.city}, ${cepData.state}, Brazil`;
      console.log(`[geocodeCEP] TENTATIVA C - Cidade apenas: ${cityQuery}`);

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityQuery)}&limit=1`;

      const nominatimResponse = await fetchWithRetry(
        nominatimUrl,
        {
          headers: {
            'User-Agent': 'Envio Legal App',
          },
          signal: AbortSignal.timeout(8000),
        },
        0
      );

      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();

        if (nominatimData && nominatimData.length > 0) {
          const coordinates: GeoCoordinates = {
            lat: parseFloat(nominatimData[0].lat),
            lng: parseFloat(nominatimData[0].lon),
          };

          console.log(`[geocodeCEP] ⚠️  TENTATIVA C bem-sucedida (city_fallback):`, coordinates);
          geocodingCache.set(cacheKey, { coordinates, precision: 'city_fallback', provider: 'nominatim' });

          return {
            success: true,
            coordinates,
            precision: 'city_fallback',
            provider: 'nominatim',
          };
        }
      }
    } catch (error) {
      console.warn('[geocodeCEP] TENTATIVA C falhou, tentando D (estado)...', error);
    }

    // ============================================================
    // TENTATIVA D - Capital do estado (fallback forte, último recurso)
    // ============================================================
    const stateCoordinates = getUFCoordinates(cepData.state);

    if (!stateCoordinates) {
      return {
        success: false,
        error: 'Estado não reconhecido',
      };
    }

    console.log(`[geocodeCEP] ⚠️  TENTATIVA D - Estado (${cepData.state}) - BAIXA PRECISÃO`);
    geocodingCache.set(cacheKey, { coordinates: stateCoordinates, precision: 'state_fallback', provider: 'hardcoded' });

    return {
      success: true,
      coordinates: stateCoordinates,
      precision: 'state_fallback',
      provider: 'hardcoded',
    };

  } catch (error) {
    console.error('[geocodeCEP] Erro em todas as tentativas:', error);
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
    const addressDetails: AddressDetails | undefined =
      (address.logradouro && address.bairro && address.cidade && address.uf)
        ? {
            street: address.logradouro,
            neighborhood: address.bairro,
            city: address.cidade,
            state: address.uf,
          }
        : undefined;

    const cepResult = await geocodeCEP(address.cep, addressDetails);
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

    const response = await fetchWithRetry(
      nominatimUrl,
      {
        headers: {
          'User-Agent': 'Envio Legal App',
        },
        signal: AbortSignal.timeout(10000),
      },
      1
    );

    if (!response.ok) {
      // Fallback: tentar usar coordenadas da capital se tiver UF
      if (address.uf) {
        const stateCoordinates = getUFCoordinates(address.uf);
        if (stateCoordinates) {
          console.log(`[geocodeAddress] Using state capital coordinates for ${address.uf}`);
          return {
            success: true,
            coordinates: stateCoordinates,
            precision: 'state_fallback',
            provider: 'hardcoded',
          };
        }
      }

      return {
        success: false,
        error: 'Erro ao geocodificar endereço',
      };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      // Fallback: tentar usar coordenadas da capital se tiver UF
      if (address.uf) {
        const stateCoordinates = getUFCoordinates(address.uf);
        if (stateCoordinates) {
          console.log(`[geocodeAddress] No results, using state capital coordinates for ${address.uf}`);
          return {
            success: true,
            coordinates: stateCoordinates,
            precision: 'state_fallback',
            provider: 'hardcoded',
          };
        }
      }

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
      precision: 'address',
      provider: 'nominatim',
    };
  } catch (error) {
    console.error('[geocodeAddress] Error:', error);

    // Fallback final: tentar usar coordenadas da capital se tiver UF
    if (address.uf) {
      const stateCoordinates = getUFCoordinates(address.uf);
      if (stateCoordinates) {
        console.log(`[geocodeAddress] Error fallback, using state capital coordinates for ${address.uf}`);
        return {
          success: true,
          coordinates: stateCoordinates,
          precision: 'state_fallback',
          provider: 'hardcoded',
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
