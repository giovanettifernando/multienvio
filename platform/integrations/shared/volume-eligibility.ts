/**
 * Sistema de Elegibilidade de Volumes por Transportadora
 *
 * Este módulo define tipos e interfaces para validação de volumes
 * por transportadora, permitindo decisões granulares sobre quais
 * transportadoras podem cotar quais volumes.
 */

// ============================================================================
// Tipos de Entrada
// ============================================================================

/**
 * Dados de um volume para validação
 */
export type VolumeInput = {
  index: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  pesoKg: number;
};

// ============================================================================
// Tipos de Resultado de Validação
// ============================================================================

/**
 * Valores computados durante a validação de um volume
 */
export type VolumeComputedValues = {
  pesoRealKg: number;
  pesoCubadoKg: number;
  chargeableWeightKg: number; // max(pesoReal, pesoCubado)
  maiorLadoCm: number;
  somaDimensoesCm: number;
  dimsOrdenadas: [number, number, number]; // [menor, médio, maior]
};

/**
 * Resultado da validação de um volume para uma transportadora específica
 */
export type VolumeValidationResult = {
  volumeIndex: number;
  isValid: boolean;
  reasons: string[]; // Ex: "Peso para cobrança excede 30kg"
  computed: VolumeComputedValues;
};

/**
 * Elegibilidade de uma transportadora para a cotação completa
 */
export type CarrierEligibility = {
  carrierId: string;
  carrierName: string;
  isEligible: boolean; // true se TODOS os volumes são válidos
  volumeResults: VolumeValidationResult[];
  overallReasons: string[]; // Razões consolidadas se inelegível
};

/**
 * Resumo de elegibilidade por volume (consolidando todas transportadoras)
 */
export type VolumeEligibilitySummary = {
  volumeIndex: number;
  eligibleCarriers: string[]; // IDs das transportadoras que aceitam
  ineligibleCarriers: Array<{ carrierId: string; reasons: string[] }>;
  hasAnyCarrier: boolean; // true se pelo menos 1 transportadora aceita
  consolidatedReasons: string[]; // Razões de todas transportadoras
};

/**
 * Resultado final de elegibilidade para toda a cotação
 */
export type QuoteEligibilityResult = {
  carriers: CarrierEligibility[];
  volumes: VolumeEligibilitySummary[];
  hasBlockingVolumes: boolean; // true se algum volume não tem nenhuma transportadora
  blockingVolumeIndexes: number[]; // Índices dos volumes bloqueantes
};

// ============================================================================
// Interface de Validador
// ============================================================================

/**
 * Interface que cada transportadora deve implementar para validação de volumes
 */
export interface CarrierVolumeValidator {
  readonly carrierId: string;
  readonly carrierName: string;

  /**
   * Valida um único volume para esta transportadora
   */
  validateVolume(volume: VolumeInput): VolumeValidationResult;

  /**
   * Verifica se a transportadora pode cotar TODOS os volumes
   * (atalho para validar todos e verificar se todos são válidos)
   */
  canQuoteAllVolumes(volumes: VolumeInput[]): boolean;
}

// ============================================================================
// Tipos para API Response
// ============================================================================

/**
 * Informações de elegibilidade retornadas na resposta da API
 */
export type EligibilityApiResponse = {
  hasBlockingVolumes: boolean;
  blockingVolumeIndexes: number[];
  volumeDetails: Array<{
    volumeIndex: number;
    hasAnyCarrier: boolean;
    reasons: string[];
  }>;
};

/**
 * Converte QuoteEligibilityResult para formato da API
 */
export function toEligibilityApiResponse(
  result: QuoteEligibilityResult
): EligibilityApiResponse {
  return {
    hasBlockingVolumes: result.hasBlockingVolumes,
    blockingVolumeIndexes: result.blockingVolumeIndexes,
    volumeDetails: result.volumes.map((v) => ({
      volumeIndex: v.volumeIndex,
      hasAnyCarrier: v.hasAnyCarrier,
      reasons: v.consolidatedReasons,
    })),
  };
}
