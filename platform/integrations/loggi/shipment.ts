import 'server-only';

/**
 * Criação de envios na Loggi (async-shipments)
 *
 * Endpoint: POST /v1/companies/{companyId}/async-shipments
 *
 * Cria envios de forma assíncrona. Retorna loggiKey e trackingCode.
 */

import type {
  LoggiShipmentRequest,
  LoggiShipmentResponse,
  LoggiCorreiosAddress,
} from './types';
import { LoggiApiError } from './types';
import { LOGGI_ENDPOINTS } from './constants';
import { loggiFetch } from './client';

// ============================================================================
// Input simplificado
// ============================================================================

export interface CreateLoggiShipmentInput {
  /** ID do serviço externo (ex: REVS-DROF-DOOR-STAN-01) */
  externalServiceId: string;
  /** Remetente */
  sender: {
    name: string;
    phoneNumber?: string;
    federalTaxId: string;
    address: LoggiCorreiosAddress;
    instructions?: string;
  };
  /** Destinatário */
  receiver: {
    name: string;
    email?: string;
    phoneNumber?: string;
    federalTaxId: string;
    stateTaxId?: string;
    address: LoggiCorreiosAddress;
    instructions?: string;
  };
  /** Pacotes */
  packages: Array<{
    trackingCode?: string;
    freightType: string;
    weightG: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    invoice?: {
      key: string;
      series: string;
      number: string;
      totalValue: string;
      icms?: string;
      items?: Array<{ description: string }>;
    };
    contentDeclaration?: {
      totalValue: string;
      description: string;
    };
  }>;
}

// ============================================================================
// Criar Shipment
// ============================================================================

/**
 * Cria um envio assíncrono na Loggi
 */
export async function createLoggiShipment(
  input: CreateLoggiShipmentInput
): Promise<LoggiShipmentResponse> {
  if (!input.sender?.name || !input.sender?.federalTaxId) {
    throw new LoggiApiError('VALIDATION', 'Dados do remetente incompletos');
  }
  if (!input.receiver?.name || !input.receiver?.federalTaxId) {
    throw new LoggiApiError('VALIDATION', 'Dados do destinatário incompletos');
  }
  if (!input.packages || input.packages.length === 0) {
    throw new LoggiApiError('VALIDATION', 'Pelo menos um pacote é obrigatório');
  }

  const shipmentRequest: LoggiShipmentRequest = {
    externalServiceId: input.externalServiceId,
    shipFrom: {
      name: input.sender.name,
      phoneNumber: input.sender.phoneNumber,
      federalTaxId: input.sender.federalTaxId,
      address: {
        instructions: input.sender.instructions || '',
        correiosAddress: input.sender.address,
      },
    },
    shipTo: {
      name: input.receiver.name,
      email: input.receiver.email,
      phoneNumber: input.receiver.phoneNumber,
      federalTaxId: input.receiver.federalTaxId,
      stateTaxId: input.receiver.stateTaxId,
      address: {
        instructions: input.receiver.instructions || '',
        correiosAddress: input.receiver.address,
      },
    },
    packages: input.packages.map((pkg) => ({
      trackingCode: pkg.trackingCode,
      freightType: pkg.freightType,
      weightG: pkg.weightG,
      lengthCm: pkg.lengthCm,
      widthCm: pkg.widthCm,
      heightCm: pkg.heightCm,
      packaged: true,
      labelled: true,
      documentTypes: pkg.invoice ? [{
        invoice: {
          key: pkg.invoice.key,
          series: pkg.invoice.series,
          number: pkg.invoice.number,
          totalValue: pkg.invoice.totalValue,
          icms: pkg.invoice.icms || 'ICMS_NOT_TAXED',
          items: pkg.invoice.items,
        },
      }] : pkg.contentDeclaration ? [{
        contentDeclaration: {
          totalValue: pkg.contentDeclaration.totalValue,
          description: pkg.contentDeclaration.description,
        },
      }] : undefined,
    })),
  };

  console.log('[LOGGI_SHIPMENT] Creating shipment:', {
    externalServiceId: input.externalServiceId,
    senderCep: input.sender.address.cep,
    receiverCep: input.receiver.address.cep,
    packages: input.packages.length,
  });

  const response = await loggiFetch<LoggiShipmentResponse>(
    LOGGI_ENDPOINTS.asyncShipment,
    shipmentRequest as unknown as Record<string, unknown>,
  );

  console.log('[LOGGI_SHIPMENT] Shipment response:', {
    packages: response.packages?.length || 0,
    loggiKeys: response.packages?.map((p) => p.loggiKey),
  });

  return response;
}
