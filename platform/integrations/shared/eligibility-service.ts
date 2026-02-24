/**
 * Serviço de Elegibilidade de Volumes
 *
 * Coordena validadores de múltiplas transportadoras para determinar
 * quais transportadoras podem cotar quais volumes.
 *
 * Responsabilidades:
 * - Registrar validadores de transportadoras
 * - Avaliar elegibilidade de todas transportadoras para todos volumes
 * - Consolidar resultados por volume e por transportadora
 * - Identificar volumes bloqueantes (sem nenhuma transportadora)
 */

import type {
  CarrierVolumeValidator,
  VolumeInput,
  VolumeValidationResult,
  CarrierEligibility,
  VolumeEligibilitySummary,
  QuoteEligibilityResult,
} from './volume-eligibility';
import { correiosVolumeValidator } from '../correios/correios-volume-validator';
import { jtVolumeValidator } from '../jt/jt-volume-validator';
import { loggiVolumeValidator } from '../loggi/loggi-volume-validator';

// ============================================================================
// Serviço de Elegibilidade
// ============================================================================

export class EligibilityService {
  private validators: Map<string, CarrierVolumeValidator> = new Map();

  constructor() {
    // Registrar validadores padrão
    this.registerValidator(correiosVolumeValidator);
    this.registerValidator(jtVolumeValidator);
    this.registerValidator(loggiVolumeValidator);
  }

  /**
   * Registra um validador de transportadora
   */
  registerValidator(validator: CarrierVolumeValidator): void {
    this.validators.set(validator.carrierId, validator);
  }

  /**
   * Remove um validador de transportadora
   */
  unregisterValidator(carrierId: string): void {
    this.validators.delete(carrierId);
  }

  /**
   * Obtém um validador específico
   */
  getValidator(carrierId: string): CarrierVolumeValidator | undefined {
    return this.validators.get(carrierId);
  }

  /**
   * Lista todas as transportadoras registradas
   */
  getRegisteredCarriers(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Avalia elegibilidade de todas transportadoras para os volumes
   */
  evaluateEligibility(volumes: VolumeInput[]): QuoteEligibilityResult {
    if (volumes.length === 0) {
      return {
        carriers: [],
        volumes: [],
        hasBlockingVolumes: false,
        blockingVolumeIndexes: [],
      };
    }

    // 1. Avaliar cada transportadora
    const carriersResults: CarrierEligibility[] = [];

    for (const [, validator] of this.validators) {
      const volumeResults = volumes.map((v) => validator.validateVolume(v));
      const isEligible = volumeResults.every((r) => r.isValid);

      carriersResults.push({
        carrierId: validator.carrierId,
        carrierName: validator.carrierName,
        isEligible,
        volumeResults,
        overallReasons: isEligible
          ? []
          : this.consolidateReasons(volumeResults),
      });
    }

    // 2. Consolidar por volume
    const volumesSummary: VolumeEligibilitySummary[] = volumes.map(
      (vol, index) => {
        const eligible: string[] = [];
        const ineligible: Array<{ carrierId: string; reasons: string[] }> = [];
        const allReasons: string[] = [];

        for (const carrier of carriersResults) {
          const volumeResult = carrier.volumeResults.find(
            (r) => r.volumeIndex === index
          );
          if (volumeResult?.isValid) {
            eligible.push(carrier.carrierId);
          } else {
            const reasons = volumeResult?.reasons || [];
            ineligible.push({
              carrierId: carrier.carrierId,
              reasons,
            });
            // Coletar razões únicas
            for (const reason of reasons) {
              if (!allReasons.includes(reason)) {
                allReasons.push(reason);
              }
            }
          }
        }

        return {
          volumeIndex: index,
          eligibleCarriers: eligible,
          ineligibleCarriers: ineligible,
          hasAnyCarrier: eligible.length > 0,
          consolidatedReasons: allReasons,
        };
      }
    );

    // 3. Identificar volumes bloqueantes
    const blockingVolumeIndexes = volumesSummary
      .filter((v) => !v.hasAnyCarrier)
      .map((v) => v.volumeIndex);

    return {
      carriers: carriersResults,
      volumes: volumesSummary,
      hasBlockingVolumes: blockingVolumeIndexes.length > 0,
      blockingVolumeIndexes,
    };
  }

  /**
   * Avalia elegibilidade de uma transportadora específica
   */
  evaluateCarrierEligibility(
    carrierId: string,
    volumes: VolumeInput[]
  ): CarrierEligibility | null {
    const validator = this.validators.get(carrierId);
    if (!validator) {
      return null;
    }

    const volumeResults = volumes.map((v) => validator.validateVolume(v));
    const isEligible = volumeResults.every((r) => r.isValid);

    return {
      carrierId: validator.carrierId,
      carrierName: validator.carrierName,
      isEligible,
      volumeResults,
      overallReasons: isEligible ? [] : this.consolidateReasons(volumeResults),
    };
  }

  /**
   * Verifica rapidamente se uma transportadora pode cotar todos os volumes
   */
  canCarrierQuote(carrierId: string, volumes: VolumeInput[]): boolean {
    const validator = this.validators.get(carrierId);
    if (!validator) {
      return false;
    }
    return validator.canQuoteAllVolumes(volumes);
  }

  /**
   * Consolida razões de falha de múltiplos volumes
   */
  private consolidateReasons(volumeResults: VolumeValidationResult[]): string[] {
    const uniqueReasons = new Set<string>();
    for (const result of volumeResults) {
      if (!result.isValid) {
        for (const reason of result.reasons) {
          uniqueReasons.add(reason);
        }
      }
    }
    return Array.from(uniqueReasons);
  }
}

// ============================================================================
// Singleton Global
// ============================================================================

let eligibilityServiceInstance: EligibilityService | null = null;

/**
 * Obtém a instância global do EligibilityService
 */
export function getEligibilityService(): EligibilityService {
  if (!eligibilityServiceInstance) {
    eligibilityServiceInstance = new EligibilityService();
  }
  return eligibilityServiceInstance;
}

/**
 * Reseta a instância global (útil para testes)
 */
export function resetEligibilityService(): void {
  eligibilityServiceInstance = null;
}
