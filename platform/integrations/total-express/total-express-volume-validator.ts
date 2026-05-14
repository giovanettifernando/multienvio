import type {
  CarrierVolumeValidator,
  VolumeInput,
  VolumeValidationResult,
  VolumeComputedValues,
} from '../shared/volume-eligibility';
import { TE_VOLUME_RULES, TE_CARRIER_SLUG, TE_CARRIER_NAME } from './constants';

export function computeTEVolumeValues(volume: VolumeInput): VolumeComputedValues {
  const pesoRealKg = volume.pesoKg;
  const pesoCubadoKgRaw =
    (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) /
    TE_VOLUME_RULES.CUBAGE_FACTOR;
  const pesoCubadoKg = Math.round(pesoCubadoKgRaw * 10000) / 10000;
  const chargeableWeightKg = Math.max(pesoRealKg, pesoCubadoKg);

  const dims = [volume.comprimentoCm, volume.larguraCm, volume.alturaCm].sort(
    (a, b) => a - b
  ) as [number, number, number];

  return {
    pesoRealKg,
    pesoCubadoKg,
    chargeableWeightKg,
    maiorLadoCm: dims[2],
    somaDimensoesCm: dims[0] + dims[1] + dims[2],
    dimsOrdenadas: dims,
  };
}

export class TotalExpressVolumeValidator implements CarrierVolumeValidator {
  readonly carrierId = TE_CARRIER_SLUG;
  readonly carrierName = TE_CARRIER_NAME;

  validateVolume(volume: VolumeInput): VolumeValidationResult {
    const reasons: string[] = [];
    const computed = computeTEVolumeValues(volume);

    if (volume.comprimentoCm <= 0 || volume.larguraCm <= 0 || volume.alturaCm <= 0) {
      reasons.push('Todas as dimensões devem ser maiores que zero');
    }

    if (volume.pesoKg <= 0) {
      reasons.push('Peso deve ser maior que zero');
    }

    if (computed.chargeableWeightKg > TE_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG) {
      reasons.push(
        `Peso para cobrança (${computed.chargeableWeightKg.toFixed(2)}kg) excede ${TE_VOLUME_RULES.MAX_CHARGEABLE_WEIGHT_KG}kg (Total Express)`
      );
    }

    if (computed.maiorLadoCm > TE_VOLUME_RULES.MAX_LADO_CM) {
      reasons.push(
        `Maior lado (${computed.maiorLadoCm}cm) excede ${TE_VOLUME_RULES.MAX_LADO_CM}cm (Total Express)`
      );
    }

    if (computed.somaDimensoesCm > TE_VOLUME_RULES.MAX_SOMA_LADOS_CM) {
      reasons.push(
        `Soma dos lados (${computed.somaDimensoesCm}cm) excede ${TE_VOLUME_RULES.MAX_SOMA_LADOS_CM}cm (Total Express)`
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

export const totalExpressVolumeValidator = new TotalExpressVolumeValidator();
