/**
 * Validador de Volumes para a J&T Express
 *
 * Implementa as regras específicas da J&T para validação de volumes:
 * - Peso máximo: 30kg
 * - Dimensões: > 0
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
// Constantes de Regras da J&T
// ============================================================================

export const JT_VOLUME_RULES = {
  /** Peso máximo para cobrança (chargeableWeight) em kg */
  MAX_CHARGEABLE_WEIGHT_KG: 30,
  /** Fator de cubagem */
  CUBAGE_FACTOR: 6000,
} as const;

// ============================================================================
// Funções Auxiliares
// ============================================================================

/**
 * Calcula valores derivados de um volume para J&T
 */
export function computeJTVolumeValues(volume: VolumeInput): VolumeComputedValues {
  const pesoRealKg = volume.pesoKg;

  // Peso cubado: (C × L × A) / 6000
  const pesoCubadoKg =
    (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) /
    JT_VOLUME_RULES.CUBAGE_FACTOR;

  // Peso para cobrança: maior entre real e cubado
  const chargeableWeightKg = Math.max(pesoRealKg, pesoCubadoKg);

  // Ordenar dimensões
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
// Validador da J&T
// ============================================================================

export class JTVolumeValidator implements CarrierVolumeValidator {
  readonly carrierId = 'jt';
  readonly carrierName = 'J&T Express';

  /**
   * Valida um único volume conforme regras da J&T
   */
  validateVolume(volume: VolumeInput): VolumeValidationResult {
    const reasons: string[] = [];
    const computed = computeJTVolumeValues(volume);

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

    // 3. Validar peso para cobrança
    if (computed.chargeableWeightKg > JT_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG) {
      reasons.push(
        `Peso para cobrança (${computed.chargeableWeightKg.toFixed(2)}kg) excede ${JT_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG}kg (J&T)`
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
   * Verifica se todos os volumes são válidos para a J&T
   */
  canQuoteAllVolumes(volumes: VolumeInput[]): boolean {
    return volumes.every((v) => this.validateVolume(v).isValid);
  }
}

// Singleton para uso comum
export const jtVolumeValidator = new JTVolumeValidator();
