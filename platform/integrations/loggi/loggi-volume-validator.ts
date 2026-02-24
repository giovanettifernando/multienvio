import 'server-only';

/**
 * Validação de volumes para a Loggi
 *
 * Regras:
 * - Peso máximo: 30kg (peso taxável = max(real, cubado))
 * - Dimensão máxima por lado: 100cm
 * - Fator de cubagem: 6000
 */

import type {
  CarrierVolumeValidator,
  VolumeInput,
  VolumeValidationResult,
  VolumeComputedValues,
} from '../shared/volume-eligibility';

// ============================================================================
// Regras
// ============================================================================

export const LOGGI_VOLUME_RULES = {
  MAX_CHARGEABLE_WEIGHT_KG: 30,
  MAX_DIMENSION_CM: 100,
  CUBAGE_FACTOR: 6000,
};

// ============================================================================
// Computed Values
// ============================================================================

export function computeLoggiVolumeValues(volume: VolumeInput): VolumeComputedValues {
  const dims = [volume.comprimentoCm, volume.larguraCm, volume.alturaCm].sort((a, b) => a - b);

  const pesoRealKg = volume.pesoKg;
  const pesoCubadoKg = (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) / LOGGI_VOLUME_RULES.CUBAGE_FACTOR;
  const chargeableWeightKg = Math.max(pesoRealKg, pesoCubadoKg);

  return {
    pesoRealKg,
    pesoCubadoKg: Math.round(pesoCubadoKg * 100) / 100,
    chargeableWeightKg: Math.round(chargeableWeightKg * 100) / 100,
    maiorLadoCm: dims[2],
    somaDimensoesCm: dims[0] + dims[1] + dims[2],
    dimsOrdenadas: dims as [number, number, number],
  };
}

// ============================================================================
// Validator
// ============================================================================

export class LoggiVolumeValidator implements CarrierVolumeValidator {
  readonly carrierId = 'loggi';
  readonly carrierName = 'Loggi';

  validateVolume(volume: VolumeInput): VolumeValidationResult {
    const reasons: string[] = [];
    const computed = computeLoggiVolumeValues(volume);

    // Dimensões positivas
    if (volume.comprimentoCm <= 0 || volume.larguraCm <= 0 || volume.alturaCm <= 0) {
      reasons.push('Dimensões devem ser maiores que zero');
    }

    // Peso positivo
    if (volume.pesoKg <= 0) {
      reasons.push('Peso deve ser maior que zero');
    }

    // Peso taxável máximo
    if (computed.chargeableWeightKg > LOGGI_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG) {
      reasons.push(
        `Peso taxável (${computed.chargeableWeightKg}kg) excede o máximo de ${LOGGI_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG}kg`
      );
    }

    // Cada lado ≤ 100cm
    if (computed.maiorLadoCm > LOGGI_VOLUME_RULES.MAX_DIMENSION_CM) {
      reasons.push(
        `Maior lado (${computed.maiorLadoCm}cm) excede o máximo de ${LOGGI_VOLUME_RULES.MAX_DIMENSION_CM}cm`
      );
    }

    return {
      volumeIndex: volume.index,
      isValid: reasons.length === 0,
      reasons,
      computed,
    };
  }

  canQuoteAllVolumes(volumes: VolumeInput[]): boolean {
    return volumes.every((v) => this.validateVolume(v).isValid);
  }
}

export const loggiVolumeValidator = new LoggiVolumeValidator();
