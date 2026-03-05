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
import {
  createLoggiShipment,
  isLoggiAvailableAsync,
  cotarLoggi,
  type CreateLoggiShipmentInput,
} from '@/platform/integrations/loggi';
import {
  createJTOrder,
  isJTAvailableAsync,
  type JTSenderReceiver,
} from '@/platform/integrations/jt';

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

  if (carrierNormalized === 'loggi') {
    return await integrateWithLoggi(tx, input);
  }

  if (carrierNormalized === 'j&t' || carrierNormalized === 'jt') {
    return await integrateWithJT(tx, input);
  }

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

/**
 * Integração específica com Loggi
 */
async function integrateWithLoggi(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: CarrierIntegrationInput
): Promise<CarrierIntegrationResult> {
  const { shipmentId, packages, sender, recipient, serviceName, serviceCode } = input;

  console.log('[CARRIER_INTEGRATION_LOGGI] Starting Loggi integration:', {
    shipmentId,
    serviceName,
    serviceCode,
    packagesCount: packages.length,
  });

  try {
    // 1. Verificar se Loggi está configurada
    const isAvailable = await isLoggiAvailableAsync();
    if (!isAvailable) {
      console.warn('[CARRIER_INTEGRATION_LOGGI] Loggi not configured');
      return {
        success: false,
        carrier: 'Loggi',
        errorMessage: 'Integração da Loggi não está configurada',
      };
    }

    // 2. Resolver externalServiceId (vem do serviceCode via quote metadata)
    let externalServiceId: string | undefined = serviceCode;
    if (!externalServiceId) {
      // Fallback: re-quote to find the externalServiceId
      console.log('[CARRIER_INTEGRATION_LOGGI] No externalServiceId in metadata — re-quoting to find it');
      externalServiceId = await resolveLoggiExternalServiceId(
        sender.cep,
        recipient.cep,
        packages,
        serviceName,
      ) ?? undefined;
    }
    if (!externalServiceId) {
      console.error('[CARRIER_INTEGRATION_LOGGI] Could not resolve externalServiceId:', {
        serviceName,
        serviceCode,
      });
      return {
        success: false,
        carrier: 'Loggi',
        errorMessage: 'ID do serviço Loggi não disponível. Tente novamente.',
      };
    }

    // 3. Montar input para a API da Loggi
    const loggiInput: CreateLoggiShipmentInput = {
      externalServiceId,
      sender: {
        name: sender.nome,
        phoneNumber: sender.telefone,
        federalTaxId: sender.documento.replace(/\D/g, ''),
        address: {
          logradouro: sender.logradouro || '',
          numero: sender.numero || 'S/N',
          complemento: sender.complemento,
          bairro: sender.bairro || '',
          cep: sender.cep.replace(/\D/g, ''),
          cidade: sender.cidade || '',
          uf: sender.uf || '',
        },
      },
      receiver: {
        name: recipient.nome,
        email: recipient.email,
        phoneNumber: recipient.telefone,
        federalTaxId: (recipient.documento || sender.documento).replace(/\D/g, ''),
        address: {
          logradouro: recipient.logradouro,
          numero: recipient.numero || 'S/N',
          complemento: recipient.complemento,
          bairro: recipient.bairro || '',
          cep: recipient.cep.replace(/\D/g, ''),
          cidade: recipient.cidade,
          uf: recipient.uf,
        },
      },
      packages: packages.map((pkg) => ({
        freightType: resolveLoggiFreightAndPickup(serviceName).freightType,
        weightG: Math.round(Number(pkg.weight) * 1000),
        lengthCm: Math.round(Number(pkg.length)),
        widthCm: Math.round(Number(pkg.width)),
        heightCm: Math.round(Number(pkg.height)),
        contentDeclaration: {
          // Loggi espera totalValue em reais (string), máximo 15000
          totalValue: String(Math.min(input.declaredValue || 1, 15000)),
          description: input.contentDescription || 'Mercadorias diversas',
        },
      })),
    };

    console.log('[CARRIER_INTEGRATION_LOGGI] Calling createLoggiShipment:', {
      externalServiceId,
      packagesCount: loggiInput.packages.length,
    });

    // 4. Criar shipment na Loggi
    const response = await createLoggiShipment(loggiInput);

    if (!response.packages || response.packages.length === 0) {
      return {
        success: false,
        carrier: 'Loggi',
        errorMessage: 'Loggi não retornou pacotes na resposta',
      };
    }

    // 5. Atualizar packages no banco com tracking codes e loggiKeys
    const packageUpdates: CarrierIntegrationResult['packageUpdates'] = [];
    const loggiKeys: string[] = [];

    for (let i = 0; i < response.packages.length; i++) {
      const loggiPkg = response.packages[i];
      const pkg = packages[i]; // Match by position

      if (pkg && loggiPkg) {
        loggiKeys.push(loggiPkg.loggiKey);

        await tx.package.update({
          where: { id: pkg.id },
          data: {
            carrierTrackingCode: loggiPkg.trackingCode,
            // Store loggiKey in carrierPrePostageId for later label generation
            carrierPrePostageId: loggiPkg.loggiKey,
          },
        });

        packageUpdates.push({
          packageId: pkg.id,
          packageNumber: pkg.packageNumber,
          carrierTrackingCode: loggiPkg.trackingCode,
          carrierPrePostageId: loggiPkg.loggiKey,
        });

        console.log('[CARRIER_INTEGRATION_LOGGI] Package updated:', {
          packageId: pkg.id,
          packageNumber: pkg.packageNumber,
          trackingCode: loggiPkg.trackingCode,
          loggiKey: loggiPkg.loggiKey,
        });
      }
    }

    // 6. Atualizar shipment com código de rastreio principal
    const primaryTrackingCode = response.packages[0].trackingCode;
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        carrierTrackingCode: primaryTrackingCode,
        carrierMetadata: {
          loggiKeys,
          externalServiceId,
        } as object,
      },
    });

    // 7. Atualizar label com tracking code
    await tx.label.updateMany({
      where: { shipmentId },
      data: {
        trackingCode: primaryTrackingCode,
      },
    });

    console.log('[CARRIER_INTEGRATION_LOGGI] Integration succeeded:', {
      shipmentId,
      primaryTrackingCode,
      loggiKeysCount: loggiKeys.length,
    });

    return {
      success: true,
      carrier: 'Loggi',
      primaryTrackingCode,
      packageUpdates,
    };
  } catch (error) {
    console.error('[CARRIER_INTEGRATION_LOGGI] Integration failed:', error);
    return {
      success: false,
      carrier: 'Loggi',
      errorMessage: error instanceof Error ? error.message : 'Erro na integração com Loggi',
    };
  }
}

/**
 * Re-quotes Loggi to find the externalServiceId for a given service name
 */
async function resolveLoggiExternalServiceId(
  originCep: string,
  destCep: string,
  packages: Package[],
  serviceName?: string,
): Promise<string | null> {
  try {
    const { freightType: targetFreightType, pickupType: targetPickupType } = resolveLoggiFreightAndPickup(serviceName);
    const quoteResponse = await cotarLoggi({
      originCep: originCep.replace(/\D/g, ''),
      destCep: destCep.replace(/\D/g, ''),
      packages: packages.map((pkg) => ({
        weightG: Math.round(Number(pkg.weight) * 1000),
        lengthCm: Math.round(Number(pkg.length)),
        widthCm: Math.round(Number(pkg.width)),
        heightCm: Math.round(Number(pkg.height)),
      })),
    });

    // Find the matching quotation by freightType + pickupType
    const allQuotations = quoteResponse.packagesQuotations?.[0]?.quotations || [];
    const match = (targetPickupType
        ? allQuotations.find((q) => q.freightType === targetFreightType && q.pickupType === targetPickupType)
        : null)
      || allQuotations.find((q) => q.freightType === targetFreightType)
      || allQuotations[0]; // Fallback to first available

    if (match?.externalServiceId) {
      console.log('[CARRIER_INTEGRATION_LOGGI] Resolved externalServiceId via re-quote:', {
        externalServiceId: match.externalServiceId,
        freightType: match.freightType,
      });
      return match.externalServiceId;
    }

    console.warn('[CARRIER_INTEGRATION_LOGGI] No matching quotation found in re-quote');
    return null;
  } catch (error) {
    console.error('[CARRIER_INTEGRATION_LOGGI] Re-quote failed:', error);
    return null;
  }
}

/**
 * Resolve o tipo de frete e pickup da Loggi a partir do nome do serviço
 */
function resolveLoggiFreightAndPickup(serviceName?: string): { freightType: string; pickupType?: string } {
  if (!serviceName) return { freightType: 'FREIGHT_TYPE_ECONOMIC' };
  const normalized = serviceName.toLowerCase();
  const freightType = normalized.includes('express') ? 'FREIGHT_TYPE_EXPRESS' : 'FREIGHT_TYPE_ECONOMIC';

  let pickupType: string | undefined;
  if (normalized.includes('postagem') || normalized.includes('drop')) {
    pickupType = 'PICKUP_TYPE_DROP_OFF';
  } else if (normalized.includes('coleta') || normalized.includes('spot')) {
    pickupType = 'PICKUP_TYPE_SPOT';
  }

  return { freightType, pickupType };
}

/**
 * Integração específica com J&T Express
 */
async function integrateWithJT(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: CarrierIntegrationInput
): Promise<CarrierIntegrationResult> {
  const { shipmentId, packages, sender, recipient } = input;

  console.log('[CARRIER_INTEGRATION_JT] Starting J&T integration:', {
    shipmentId,
    packagesCount: packages.length,
  });

  try {
    // 1. Verificar se J&T está configurada
    const isAvailable = await isJTAvailableAsync();
    if (!isAvailable) {
      console.warn('[CARRIER_INTEGRATION_JT] J&T not configured');
      return {
        success: false,
        carrier: 'J&T',
        errorMessage: 'Integração da J&T não está configurada',
      };
    }

    // 2. Montar dados de remetente e destinatário no formato J&T
    const jtSender: JTSenderReceiver = {
      name: sender.nome,
      postCode: sender.cep.replace(/\D/g, ''),
      taxNumber: sender.documento.replace(/\D/g, ''),
      mobile: sender.telefone?.replace(/\D/g, '') || undefined,
      phone: sender.telefone?.replace(/\D/g, '') || undefined,
      mailBox: sender.email || undefined,
      prov: sender.uf || '',
      city: sender.cidade || '',
      street: sender.logradouro || '',
      streetNumber: sender.numero || undefined,
      address: sender.complemento || undefined,
      area: sender.bairro || undefined,
      areaCode: sender.telefone?.replace(/\D/g, '').substring(0, 2) || undefined,
    };

    const jtReceiver: JTSenderReceiver = {
      name: recipient.nome,
      postCode: recipient.cep.replace(/\D/g, ''),
      taxNumber: (recipient.documento || sender.documento).replace(/\D/g, ''),
      mobile: recipient.telefone?.replace(/\D/g, '') || undefined,
      phone: recipient.telefone?.replace(/\D/g, '') || undefined,
      mailBox: recipient.email || undefined,
      prov: recipient.uf,
      city: recipient.cidade,
      street: recipient.logradouro,
      streetNumber: recipient.numero || undefined,
      address: recipient.complemento || undefined,
      area: recipient.bairro || undefined,
      areaCode: recipient.telefone?.replace(/\D/g, '').substring(0, 2) || undefined,
    };

    // 3. Calcular peso total
    const pesoTotalKg = packages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);

    // 4. Buscar platformTrackingCode para usar como txlogisticId
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: { platformTrackingCode: true },
    });

    const txlogisticId = shipment?.platformTrackingCode || `EL-${shipmentId}`;

    console.log('[CARRIER_INTEGRATION_JT] Calling createJTOrder:', {
      txlogisticId,
      pesoTotalKg,
    });

    // 5. Criar pedido na J&T
    const orderResponse = await createJTOrder({
      txlogisticId,
      sender: jtSender,
      receiver: jtReceiver,
      weight: pesoTotalKg,
      height: packages[0] ? Math.round(Number(packages[0].height)) : undefined,
      width: packages[0] ? Math.round(Number(packages[0].width)) : undefined,
      length: packages[0] ? Math.round(Number(packages[0].length)) : undefined,
      totalQuantity: packages.length,
      items: [{
        itemName: input.contentDescription || 'Mercadorias diversas',
        number: packages.length,
      }],
    });

    const billCode = orderResponse.data?.billCode
      || orderResponse.data?.orderList?.[0]?.billCode;

    if (!billCode) {
      console.error('[CARRIER_INTEGRATION_JT] No billCode returned:', orderResponse);
      return {
        success: false,
        carrier: 'J&T',
        errorMessage: 'J&T não retornou código de rastreio (billCode)',
      };
    }

    // 6. Atualizar packages com o billCode (usado pelo label worker)
    const packageUpdates: CarrierIntegrationResult['packageUpdates'] = [];

    for (const pkg of packages) {
      await tx.package.update({
        where: { id: pkg.id },
        data: {
          carrierTrackingCode: billCode,
        },
      });

      packageUpdates.push({
        packageId: pkg.id,
        packageNumber: pkg.packageNumber,
        carrierTrackingCode: billCode,
        carrierPrePostageId: billCode,
      });

      console.log('[CARRIER_INTEGRATION_JT] Package updated:', {
        packageId: pkg.id,
        packageNumber: pkg.packageNumber,
        billCode,
      });
    }

    // 7. Atualizar shipment com código de rastreio
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        carrierTrackingCode: billCode,
        carrierMetadata: {
          billCode,
          txlogisticId,
          sortingCode: orderResponse.data?.sortingCode,
          lastCenterName: orderResponse.data?.lastCenterName,
        } as object,
      },
    });

    // 8. Atualizar label com tracking code
    await tx.label.updateMany({
      where: { shipmentId },
      data: {
        trackingCode: billCode,
      },
    });

    console.log('[CARRIER_INTEGRATION_JT] Integration succeeded:', {
      shipmentId,
      billCode,
      txlogisticId,
    });

    return {
      success: true,
      carrier: 'J&T',
      primaryTrackingCode: billCode,
      packageUpdates,
    };
  } catch (error) {
    console.error('[CARRIER_INTEGRATION_JT] Integration failed:', error);
    return {
      success: false,
      carrier: 'J&T',
      errorMessage: error instanceof Error ? error.message : 'Erro na integração com J&T',
    };
  }
}
