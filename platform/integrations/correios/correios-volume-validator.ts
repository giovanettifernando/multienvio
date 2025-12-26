/**
 * Validador de Volumes para os Correios
 *
 * Implementa as regras específicas dos Correios para validação de volumes:
 * - Peso máximo para cobrança (chargeableWeight): 30kg
 * - Soma das dimensões: <= 200cm
 * - Maior lado: <= 100cm
 * - Dimensões mínimas (ordenadas): d1 >= 2cm, d2 >= 11cm, d3 >= 16cm
 * - Peso cubado: (C × L × A) / 6000
 * - Peso para cobrança: max(pesoReal, pesoCubado)
 */

import type {
  CarrierVolumeValidator,
  VolumeInput,
  VolumeValidationResult,
  VolumeComputedValues,
} from '../shared/volume-eligibility';

// ============================================================================
// Constantes de Regras dos Correios
// ============================================================================

export const CORREIOS_VOLUME_RULES = {
  // Peso máximo para cobrança (chargeableWeight)
  MAX_CHARGEABLE_WEIGHT_KG: 30,

  // Dimensões máximas
  MAX_SOMA_DIMENSOES_CM: 200,
  MAX_MAIOR_LADO_CM: 100,

  // Dimensões mínimas (após ordenação)
  MIN_D1_CM: 2, // menor dimensão
  MIN_D2_CM: 11, // dimensão média
  MIN_D3_CM: 16, // maior dimensão

  // Fator de cubagem dos Correios
  CUBAGE_FACTOR: 6000,
} as const;

// ============================================================================
// Funções Auxiliares
// ============================================================================

/**
 * Calcula valores derivados de um volume
 */
export function computeVolumeValues(volume: VolumeInput): VolumeComputedValues {
  const pesoRealKg = volume.pesoKg;

  // Peso cubado: (C × L × A) / 6000
  const pesoCubadoKg =
    (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) /
    CORREIOS_VOLUME_RULES.CUBAGE_FACTOR;

  // Peso para cobrança: maior entre real e cubado
  const chargeableWeightKg = Math.max(pesoRealKg, pesoCubadoKg);

  // Ordenar dimensões para validação de mínimos
  const dims = [volume.comprimentoCm, volume.larguraCm, volume.alturaCm].sort(
    (a, b) => a - b
  ) as [number, number, number];

  const somaDimensoesCm = dims[0] + dims[1] + dims[2];
  const maiorLadoCm = dims[2];

  return {
    pesoRealKg,
    pesoCubadoKg,
    chargeableWeightKg,
    maiorLadoCm,
    somaDimensoesCm,
    dimsOrdenadas: dims,
  };
}

// ============================================================================
// Validador dos Correios
// ============================================================================

export class CorreiosVolumeValidator implements CarrierVolumeValidator {
  readonly carrierId = 'correios';
  readonly carrierName = 'Correios';

  /**
   * Valida um único volume conforme regras dos Correios
   */
  validateVolume(volume: VolumeInput): VolumeValidationResult {
    const reasons: string[] = [];
    const computed = computeVolumeValues(volume);
    const [d1, d2, d3] = computed.dimsOrdenadas;

    // 1. Validar dimensões > 0
    if (
      volume.comprimentoCm <= 0 ||
      volume.larguraCm <= 0 ||
      volume.alturaCm <= 0
    ) {
      reasons.push('Todas as dimensões devem ser maiores que zero');
    }

    // 2. Validar peso real > 0
    if (volume.pesoKg <= 0) {
      reasons.push('Peso deve ser maior que zero');
    }

    // 3. Validar peso para cobrança (chargeableWeight)
    if (
      computed.chargeableWeightKg > CORREIOS_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG
    ) {
      reasons.push(
        `Peso para cobrança (${computed.chargeableWeightKg.toFixed(2)}kg) excede ${CORREIOS_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG}kg`
      );
    }

    // 4. Validar soma das dimensões
    if (computed.somaDimensoesCm > CORREIOS_VOLUME_RULES.MAX_SOMA_DIMENSOES_CM) {
      reasons.push(
        `Soma das dimensões (${computed.somaDimensoesCm}cm) excede ${CORREIOS_VOLUME_RULES.MAX_SOMA_DIMENSOES_CM}cm`
      );
    }

    // 5. Validar maior lado
    if (computed.maiorLadoCm > CORREIOS_VOLUME_RULES.MAX_MAIOR_LADO_CM) {
      reasons.push(
        `Maior lado (${computed.maiorLadoCm}cm) excede ${CORREIOS_VOLUME_RULES.MAX_MAIOR_LADO_CM}cm`
      );
    }

    // 6. Validar dimensões mínimas (usando valores ordenados)
    if (d1 > 0 && d1 < CORREIOS_VOLUME_RULES.MIN_D1_CM) {
      reasons.push(
        `Menor dimensão (${d1}cm) abaixo do mínimo ${CORREIOS_VOLUME_RULES.MIN_D1_CM}cm`
      );
    }
    if (d2 > 0 && d2 < CORREIOS_VOLUME_RULES.MIN_D2_CM) {
      reasons.push(
        `Segunda dimensão (${d2}cm) abaixo do mínimo ${CORREIOS_VOLUME_RULES.MIN_D2_CM}cm`
      );
    }
    if (d3 > 0 && d3 < CORREIOS_VOLUME_RULES.MIN_D3_CM) {
      reasons.push(
        `Maior dimensão (${d3}cm) abaixo do mínimo ${CORREIOS_VOLUME_RULES.MIN_D3_CM}cm`
      );
    }

    return {
      volumeIndex: volume.index,
      isValid: reasons.length === 0,
      reasons,
      computed,
    };
  }

  /**
   * Verifica se todos os volumes são válidos para os Correios
   */
  canQuoteAllVolumes(volumes: VolumeInput[]): boolean {
    return volumes.every((v) => this.validateVolume(v).isValid);
  }
}

// Singleton para uso comum
export const correiosVolumeValidator = new CorreiosVolumeValidator();
