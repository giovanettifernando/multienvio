/**
 * Serviço central de cálculo de distâncias
 *
 * Usa PostGIS (ST_Distance com geography) por baixo para máxima precisão.
 * Todas as distâncias são calculadas a partir de CEPs, usando a tabela cep_locations.
 *
 * REGRAS:
 * - Coordenadas vêm APENAS de CEPs (lookup em cep_locations)
 * - Usa PostGIS ST_Distance (elipsoide WGS84, precisão métrica)
 * - Considera nível de precisão do geocoding
 * - Retorna flags de confiabilidade para evitar usar distâncias imprecisas
 */

import { calculateDistanceKmFromCeps, getCoordinatesForCep } from '@/lib/services/postgis';

export interface ResultadoDistancia {
  /**
   * Distância em quilômetros (arredondada para 1 casa decimal)
   * null se não foi possível calcular
   */
  distanciaKm: number | null;

  /**
   * Se a distância pode ser considerada confiável/precisa
   * false quando usa city_fallback ou state_fallback
   */
  precisa: boolean;

  /**
   * Descrição do motivo quando não for precisa
   */
  motivoImprecisao: string | null;

  /**
   * Nível de precisão do CEP de origem
   */
  precisionOrigem: string | null;

  /**
   * Nível de precisão do CEP de destino
   */
  precisionDestino: string | null;
}

/**
 * Função centralizada para calcular distância entre dois endereços usando CEPs
 *
 * Usa PostGIS (ST_Distance) internamente para cálculo preciso.
 * Coordenadas vêm da tabela cep_locations (cache de geocoding).
 *
 * @param cepOrigem CEP do endereço de origem
 * @param cepDestino CEP do endereço de destino
 * @returns Resultado com distância e informações de precisão
 *
 * @example
 * const resultado = await calcularDistancia('58035-100', '58040-000');
 * if (resultado.precisa) {
 *   console.log(`Distância: ${resultado.distanciaKm} km`);
 * } else {
 *   console.log(`Aviso: ${resultado.motivoImprecisao}`);
 * }
 */
export async function calcularDistancia(
  cepOrigem: string,
  cepDestino: string
): Promise<ResultadoDistancia> {
  try {
    // 1. Obter coordenadas e precisão dos CEPs
    const [coordsOrigem, coordsDestino] = await Promise.all([
      getCoordinatesForCep(cepOrigem),
      getCoordinatesForCep(cepDestino),
    ]);

    const precisionOrigem = coordsOrigem.precision ?? 'unknown';
    const precisionDestino = coordsDestino.precision ?? 'unknown';

    // 2. Validar coordenadas (evitar (0,0) e valores absurdos)
    const coordsValidas = validarCoordenadas(coordsOrigem) && validarCoordenadas(coordsDestino);

    if (!coordsValidas) {
      return {
        distanciaKm: null,
        precisa: false,
        motivoImprecisao: 'Coordenadas inválidas ou não encontradas para um ou ambos os CEPs',
        precisionOrigem,
        precisionDestino,
      };
    }

    // 3. Verificar níveis de precisão
    const precisaoOK = verificarPrecisaoAceitavel(precisionOrigem, precisionDestino);

    if (!precisaoOK.aceitavel) {
      return {
        distanciaKm: null,
        precisa: false,
        motivoImprecisao: precisaoOK.motivo,
        precisionOrigem,
        precisionDestino,
      };
    }

    // 4. Calcular distância usando PostGIS (ST_Distance)
    const distanciaKm = await calculateDistanceKmFromCeps(cepOrigem, cepDestino);

    // 5. Determinar se a distância é confiável
    const confiabilidade = determinarConfiabilidade(
      distanciaKm,
      precisionOrigem,
      precisionDestino
    );

    return {
      distanciaKm,
      precisa: confiabilidade.precisa,
      motivoImprecisao: confiabilidade.motivo,
      precisionOrigem,
      precisionDestino,
    };
  } catch (error) {
    console.error('[DISTANCE] Erro ao calcular distância:', error);
    return {
      distanciaKm: null,
      precisa: false,
      motivoImprecisao: `Erro ao calcular distância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      precisionOrigem: null,
      precisionDestino: null,
    };
  }
}

/**
 * Valida se coordenadas são válidas
 */
function validarCoordenadas(coords: { lat: number; lng: number }): boolean {
  const { lat, lng } = coords;

  // Verificar se são números válidos
  if (!isFinite(lat) || !isFinite(lng)) {
    return false;
  }

  // Verificar ranges válidos
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  // Evitar (0,0) que geralmente indica erro de geocoding
  if (lat === 0 && lng === 0) {
    return false;
  }

  // Coordenadas do Brasil aproximadas: lat -33 a 5, lng -74 a -34
  // Se estiver muito fora, provável erro
  const dentroDoBrasil = lat >= -35 && lat <= 6 && lng >= -75 && lng <= -33;

  return dentroDoBrasil;
}

/**
 * Verifica se o nível de precisão é aceitável para cálculo confiável
 */
function verificarPrecisaoAceitavel(
  precisionOrigem: string,
  precisionDestino: string
): { aceitavel: boolean; motivo: string | null } {
  // Níveis de precisão ruins que NÃO devem ser usados
  const precisaoRuim = ['state_fallback', 'unknown'];

  const origemRuim = precisaoRuim.includes(precisionOrigem);
  const destinoRuim = precisaoRuim.includes(precisionDestino);

  if (origemRuim && destinoRuim) {
    return {
      aceitavel: false,
      motivo: `Geocodificação com precisão muito baixa para origem (${precisionOrigem}) e destino (${precisionDestino}). Não é possível calcular distância confiável.`,
    };
  }

  if (origemRuim) {
    return {
      aceitavel: false,
      motivo: `Geocodificação com precisão muito baixa para CEP de origem (${precisionOrigem}). Por favor, verifique o CEP.`,
    };
  }

  if (destinoRuim) {
    return {
      aceitavel: false,
      motivo: `Geocodificação com precisão muito baixa para CEP de destino (${precisionDestino}). Por favor, verifique o CEP.`,
    };
  }

  return { aceitavel: true, motivo: null };
}

/**
 * Determina confiabilidade da distância calculada
 */
function determinarConfiabilidade(
  distanciaKm: number,
  precisionOrigem: string,
  precisionDestino: string
): { precisa: boolean; motivo: string | null } {
  // Precisões boas (confiáveis)
  const precisaoBoa = ['address', 'zipcode'];

  const origemBoa = precisaoBoa.includes(precisionOrigem);
  const destinoBoa = precisaoBoa.includes(precisionDestino);

  // Ambas boas = distância precisa
  if (origemBoa && destinoBoa) {
    return { precisa: true, motivo: null };
  }

  // Pelo menos uma usa city_fallback = distância aproximada
  const origemCidade = precisionOrigem === 'city_fallback' || precisionOrigem === 'city';
  const destinoCidade = precisionDestino === 'city_fallback' || precisionDestino === 'city';

  if (origemCidade || destinoCidade) {
    let motivo = 'Precisão moderada: ';

    if (origemCidade && destinoCidade) {
      motivo += 'ambos os CEPs usam coordenadas do centro da cidade. Distância pode variar.';
    } else if (origemCidade) {
      motivo += 'CEP de origem usa coordenadas do centro da cidade. Distância pode variar.';
    } else {
      motivo += 'CEP de destino usa coordenadas do centro da cidade. Distância pode variar.';
    }

    return { precisa: false, motivo };
  }

  // Se chegou aqui, é uma mistura
  return {
    precisa: false,
    motivo: `Precisão mista: origem=${precisionOrigem}, destino=${precisionDestino}. Distância aproximada.`,
  };
}

/**
 * Wrapper para manter compatibilidade com código existente
 * @deprecated Use calcularDistancia() para obter informações completas de precisão
 */
export async function calcularDistanciaSimples(
  cepOrigem: string,
  cepDestino: string
): Promise<number | null> {
  const resultado = await calcularDistancia(cepOrigem, cepDestino);
  return resultado.distanciaKm;
}
