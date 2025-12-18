/**
 * Serviço de Integração com Transportadoras
 *
 * Responsável por chamar APIs de transportadoras após criação do shipment
 * para obter códigos de rastreio reais e criar pré-postagens.
 *
 * IMPORTANTE: Este serviço é chamado DENTRO da transação de checkout
 * para garantir consistência. Se falhar, o checkout ainda continua
 * mas sem os códigos de rastreio da transportadora.
 */

import { PrismaClient, Shipment, Package } from '@prisma/client';
import {
  criarPrePostagemMultiVolume,
  getCorreiosConfigAsync,
  validateCorreiosConfig,
  isCorreiosConfigured,
  type MultiVolumePrePostagemInput,
  type VolumePrePostagemInput,
  type CorreiosShipmentMetadata,
} from '@/platform/integrations/correios';

// Mapeamento de nomes de serviço para códigos dos Correios
const CORREIOS_SERVICE_CODE_MAP: Record<string, string> = {
  'PAC': '03298',
  'SEDEX': '03220',
  'SEDEX 10': '03158',
  'SEDEX 12': '03140',
  'SEDEX HOJE': '03204',
  'MINI ENVIOS': '04227',
};

/**
 * Dados do remetente para pré-postagem
 */
export interface SenderData {
  nome: string;
  documento: string; // CPF ou CNPJ - OBRIGATÓRIO para Correios
  telefone?: string;
  email?: string;
  cep: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

/**
 * Dados do destinatário para pré-postagem
 */
export interface RecipientData {
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  cep: string;
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
}

/**
 * Dados de um volume para integração
 */
export interface VolumeData {
  packageNumber: number;
  weight: number;      // kg
  width: number;       // cm
  height: number;      // cm
  length: number;      // cm
  quotePrice?: number; // preço da cotação deste volume
}

/**
 * Input para integração com transportadora
 */
export interface CarrierIntegrationInput {
  shipmentId: string;
  carrier: string;
  serviceName: string;
  serviceCode?: string;
  packages: Package[];
  sender: SenderData;
  recipient: RecipientData;
  declaredValue?: number;
  contentDescription?: string;
}

/**
 * Resultado da integração com transportadora
 */
export interface CarrierIntegrationResult {
  success: boolean;
  carrier: string;
  // Código de rastreio principal (para Shipment.carrierTrackingCode)
  primaryTrackingCode?: string;
  // Metadados da transportadora (para Shipment.carrierMetadata)
  carrierMetadata?: CorreiosShipmentMetadata;
  // Atualizações por package
  packageUpdates?: Array<{
    packageId: string;
    packageNumber: number;
    carrierTrackingCode: string;
    carrierPrePostageId: string;
    carrierQuotePrice?: number;
  }>;
  // Erros
  errors?: Array<{
    packageNumber: number;
    error: string;
  }>;
  // Mensagem de erro geral
  errorMessage?: string;
}

/**
 * Integra shipment com a transportadora para obter códigos de rastreio
 *
 * Esta função é chamada após criar o shipment e packages no banco.
 * Dependendo da transportadora, chama a API correspondente.
 *
 * @param tx Transação Prisma ativa
 * @param input Dados para integração
 * @returns Resultado com códigos de rastreio ou erros
 */
export async function integrateWithCarrier(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: CarrierIntegrationInput
): Promise<CarrierIntegrationResult> {
  const { carrier, shipmentId, packages } = input;

  console.log('[CARRIER_INTEGRATION] Starting integration:', {
    shipmentId,
    carrier,
    serviceName: input.serviceName,
    packagesCount: packages.length,
  });

  // Verificar qual transportadora
  const carrierNormalized = carrier.toLowerCase().trim();

  if (carrierNormalized === 'correios') {
    return await integrateWithCorreios(tx, input);
  }

  // Outras transportadoras podem ser adicionadas aqui
  // if (carrierNormalized === 'jadlog') {
  //   return await integrateWithJadlog(tx, input);
  // }

  // Transportadora não suportada - retorna sucesso sem integração
  console.log('[CARRIER_INTEGRATION] Carrier not supported for integration:', carrier);
  return {
    success: true,
    carrier,
    errorMessage: `Integração automática não disponível para ${carrier}`,
  };
}

/**
 * Integração específica com Correios
 */
async function integrateWithCorreios(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: CarrierIntegrationInput
): Promise<CarrierIntegrationResult> {
  const { shipmentId, packages, sender, recipient, serviceName, serviceCode } = input;

  console.log('[CARRIER_INTEGRATION_CORREIOS] Starting Correios integration:', {
    shipmentId,
    serviceName,
    serviceCode,
    packagesCount: packages.length,
  });

  try {
    // 1. Verificar se Correios está configurado
    const config = await getCorreiosConfigAsync();
    const validation = validateCorreiosConfig(config);

    if (!validation.valid) {
      console.warn('[CARRIER_INTEGRATION_CORREIOS] Correios not configured:', validation.errors);
      return {
        success: false,
        carrier: 'Correios',
        errorMessage: 'Integração dos Correios não está configurada',
        errors: validation.errors?.map((e, i) => ({ packageNumber: i, error: e })),
      };
    }

    // 2. Resolver código do serviço
    const codigoServico = resolveCorreiosServiceCode(serviceName, serviceCode);

    if (!codigoServico) {
      console.error('[CARRIER_INTEGRATION_CORREIOS] Could not resolve service code:', {
        serviceName,
        serviceCode,
      });
      return {
        success: false,
        carrier: 'Correios',
        errorMessage: `Código de serviço não encontrado para: ${serviceName}`,
      };
    }

    // 3. Validar dados do remetente (documento é obrigatório)
    if (!sender.documento) {
      console.error('[CARRIER_INTEGRATION_CORREIOS] Sender document is required');
      return {
        success: false,
        carrier: 'Correios',
        errorMessage: 'CPF/CNPJ do remetente é obrigatório para emissão de etiqueta dos Correios',
      };
    }

    // 4. Montar volumes para pré-postagem
    const volumes: VolumePrePostagemInput[] = packages.map((pkg) => ({
      packageNumber: pkg.packageNumber,
      weight: pkg.weight,
      width: pkg.width,
      height: pkg.height,
      length: pkg.length,
      // TODO: Se tivermos cotação por volume, passar o preço aqui
    }));

    // 5. Montar input para pré-postagem multi-volume
    const prePostagemInput: MultiVolumePrePostagemInput = {
      codigoServico,
      serviceName,
      volumes,
      destinatario: {
        nome: recipient.nome,
        documento: recipient.documento,
        telefone: recipient.telefone,
        email: recipient.email,
        cep: recipient.cep,
        logradouro: recipient.logradouro,
        numero: recipient.numero,
        complemento: recipient.complemento,
        bairro: recipient.bairro,
        cidade: recipient.cidade,
        uf: recipient.uf,
      },
      remetente: {
        nome: sender.nome,
        documento: sender.documento,
        telefone: sender.telefone,
        email: sender.email,
        cep: sender.cep,
        logradouro: sender.logradouro,
        numero: sender.numero,
        complemento: sender.complemento,
        bairro: sender.bairro,
        cidade: sender.cidade,
        uf: sender.uf,
      },
      valorDeclaradoTotal: input.declaredValue,
      // Declaração de conteúdo genérica se não houver NF-e
      itensDeclaracaoConteudo: [{
        conteudo: input.contentDescription || 'Mercadorias diversas',
        quantidade: 1,
        valor: input.declaredValue || 50,
      }],
    };

    console.log('[CARRIER_INTEGRATION_CORREIOS] Calling criarPrePostagemMultiVolume:', {
      codigoServico,
      volumesCount: volumes.length,
    });

    // 6. Criar pré-postagens nos Correios
    const result = await criarPrePostagemMultiVolume(prePostagemInput);

    if (!result.success || result.packageUpdates.length === 0) {
      console.error('[CARRIER_INTEGRATION_CORREIOS] Pre-postagem failed:', result.errors);
      return {
        success: false,
        carrier: 'Correios',
        errorMessage: result.errors?.[0]?.error || 'Falha ao criar pré-postagem nos Correios',
        errors: result.errors,
      };
    }

    // 7. Atualizar packages no banco com códigos de rastreio
    const packageUpdates: CarrierIntegrationResult['packageUpdates'] = [];

    for (const update of result.packageUpdates) {
      // Encontrar o package correspondente
      const pkg = packages.find((p) => p.packageNumber === update.packageNumber);

      if (pkg) {
        // Atualizar package no banco
        await tx.package.update({
          where: { id: pkg.id },
          data: {
            carrierTrackingCode: update.carrierTrackingCode,
            carrierPrePostageId: update.carrierPrePostageId,
            carrierQuotePrice: update.carrierQuotePrice,
          },
        });

        packageUpdates.push({
          packageId: pkg.id,
          packageNumber: update.packageNumber,
          carrierTrackingCode: update.carrierTrackingCode,
          carrierPrePostageId: update.carrierPrePostageId,
          carrierQuotePrice: update.carrierQuotePrice,
        });

        console.log('[CARRIER_INTEGRATION_CORREIOS] Package updated:', {
          packageId: pkg.id,
          packageNumber: update.packageNumber,
          trackingCode: update.carrierTrackingCode,
        });
      }
    }

    // 8. Atualizar shipment com código principal e metadados
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        carrierTrackingCode: result.primaryTrackingCode,
        carrierMetadata: result.shipmentMetadata as object,
      },
    });

    console.log('[CARRIER_INTEGRATION_CORREIOS] Shipment updated:', {
      shipmentId,
      primaryTrackingCode: result.primaryTrackingCode,
      metadata: result.shipmentMetadata,
    });

    // 9. Atualizar label com código de rastreio dos Correios
    await tx.label.updateMany({
      where: { shipmentId },
      data: {
        trackingCode: result.primaryTrackingCode,
      },
    });

    return {
      success: true,
      carrier: 'Correios',
      primaryTrackingCode: result.primaryTrackingCode,
      carrierMetadata: result.shipmentMetadata,
      packageUpdates,
      errors: result.errors,
    };
  } catch (error) {
    console.error('[CARRIER_INTEGRATION_CORREIOS] Integration failed:', error);

    return {
      success: false,
      carrier: 'Correios',
      errorMessage: error instanceof Error ? error.message : 'Erro na integração com Correios',
    };
  }
}

/**
 * Resolve código de serviço dos Correios
 *
 * Tenta encontrar o código a partir do nome do serviço ou código fornecido.
 */
function resolveCorreiosServiceCode(
  serviceName?: string,
  serviceCode?: string
): string | null {
  // Se já temos o código numérico, usar diretamente
  if (serviceCode && /^\d{5}$/.test(serviceCode)) {
    return serviceCode;
  }

  // Se o serviceName parece ser um código numérico
  if (serviceName && /^\d{5}$/.test(serviceName)) {
    return serviceName;
  }

  // Tentar mapear pelo nome
  if (serviceName) {
    const normalized = serviceName.toUpperCase().trim();

    // Verificar mapa direto
    if (CORREIOS_SERVICE_CODE_MAP[normalized]) {
      return CORREIOS_SERVICE_CODE_MAP[normalized];
    }

    // Verificar se contém palavras-chave
    if (normalized.includes('PAC')) {
      return CORREIOS_SERVICE_CODE_MAP['PAC'];
    }
    if (normalized.includes('SEDEX 10')) {
      return CORREIOS_SERVICE_CODE_MAP['SEDEX 10'];
    }
    if (normalized.includes('SEDEX 12')) {
      return CORREIOS_SERVICE_CODE_MAP['SEDEX 12'];
    }
    if (normalized.includes('SEDEX HOJE')) {
      return CORREIOS_SERVICE_CODE_MAP['SEDEX HOJE'];
    }
    if (normalized.includes('SEDEX')) {
      return CORREIOS_SERVICE_CODE_MAP['SEDEX'];
    }
    if (normalized.includes('MINI')) {
      return CORREIOS_SERVICE_CODE_MAP['MINI ENVIOS'];
    }
  }

  // Tentar usar serviceCode como fallback
  if (serviceCode) {
    const normalized = serviceCode.toUpperCase().trim();
    if (CORREIOS_SERVICE_CODE_MAP[normalized]) {
      return CORREIOS_SERVICE_CODE_MAP[normalized];
    }
  }

  return null;
}
