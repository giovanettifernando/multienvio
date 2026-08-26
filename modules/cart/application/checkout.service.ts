import 'server-only';

/**
 * Checkout Service
 *
 * Centraliza a lógica de negócio do checkout, separando-a da rota HTTP.
 * Responsabilidades:
 * - Validar documentos do envio
 * - Calcular valores declarados
 * - Criar shipments com volumes
 * - Integrar com transportadoras
 * - Criar eventos de rastreamento
 * - Salvar destinatários recorrentes
 */

import { Prisma, PrismaClient, Package } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { createShipmentWithVolumes } from '@/modules/shipments/application/create-with-volumes';
import { calculateCommissionsInCents, calculateInsuranceCommission, resolveCarrierSlugByName } from '@/modules/quotes/application/commission';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { integrateWithCarrier } from '@/modules/shipments/application/carrier-integration';
import { logger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';
import { isCorreiosCarrier } from '@/shared/utils/carrier';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { LabelGenerateJobPayload } from '@/platform/queue';

// ============================================================================
// TIPOS
// ============================================================================

export interface CheckoutRecipient {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  documento?: string | null;
  cep: string;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade: string;
  uf: string;
  observacoes?: string | null;
  salvarRecorrente?: boolean;
}

export interface CheckoutVolume {
  peso: number;
  altura: number;
  largura: number;
  comprimento: number;
}

export interface CheckoutNfePackage {
  chave: string;
  xmlId?: string | null;
  items: Array<{
    id: string;
    sku?: string | null;
    descricao: string;
    ncm?: string | null;
    cfop?: string | null;
    quantidade: number;
    pesoLiquido?: number | null;
    valorUnitario: number;
    valorTotal: number;
  }>;
  nfeData?: unknown;
}

export interface CheckoutDeclarationItem {
  descricao: string;
  valorUnitario: number;
  quantidade: number;
}

export interface CheckoutVolumeDeclaration {
  volumeIndex: number;
  items: Array<{
    id: string;
    descricao: string;
    valorUnitario: number;
    quantidade: number;
  }>;
}

export interface CheckoutDocument {
  type: 'NFE' | 'DECLARACAO';
  packages?: CheckoutNfePackage[];
  nfeKeys?: Array<{ chave: string }>;
  nfeItems?: Array<{
    descricao: string;
    valorUnitario: number;
    valorTotal?: number;
    quantidade: number;
  }>;
  declarationItems?: CheckoutDeclarationItem[];
  volumeDeclarations?: CheckoutVolumeDeclaration[];
}

export interface CheckoutOriginAddress {
  cep: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  nome?: string; // label/apelido do endereço
}

export interface CheckoutInput {
  userId: string;
  quoteId: string;
  recipient: CheckoutRecipient;
  document: CheckoutDocument;
  volumes: CheckoutVolume[];
  insuranceValue?: number;
  pickupPointId?: string | null;
  carrier: string;
  service: string;
  originCep: string;
  originCidade?: string;
  originUf?: string;
  originAddress?: CheckoutOriginAddress;
  destinationCep: string;
  estimatedDays: number;
  freightCost: number;
  solicitarColeta?: boolean;
  /** Carrier-specific external service ID (e.g. Loggi externalServiceId) */
  externalServiceId?: string;
}

export interface CheckoutResult {
  shipmentId: string;
  trackingCode: string;
  publicTrackingId: string | null;
  labelId: string;
  pickupRequestId: string | null;
  isIdempotent: boolean;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * SECURITY FIX F-01: Valida cotação e retorna o preço correto do servidor
 *
 * Esta função é crítica para prevenir manipulação de preços.
 * O preço SEMPRE deve vir da cotação salva no banco, nunca do cliente.
 */
export interface ValidatedQuote {
  quoteId: string;
  freightCostCents: number;
  freightCost: number;
  estimatedDays: number;
  carrier: string;
  service: string;
  /** Carrier-specific external service ID (e.g. Loggi externalServiceId) */
  externalServiceId?: string;
}

export async function validateQuoteAndGetPrice(
  quoteId: string,
  userId: string,
  clientFreightCost?: number
): Promise<ValidatedQuote> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      userId: userId, // SECURITY: Verificar ownership
    },
    include: {
      selection: true,
      options: true,
    },
  });

  if (!quote) {
    logger.warn({
      event: 'checkout_quote_not_found',
      quoteId,
      userId,
    }, 'Quote not found or does not belong to user');
    throw new ApiError({
      code: 'QUOTE_NOT_FOUND',
      message: 'Cotação não encontrada ou não pertence ao usuário.',
      status: 400,
    });
  }

  if (!quote.selection) {
    logger.warn({
      event: 'checkout_quote_no_selection',
      quoteId,
      userId,
    }, 'Quote has no selection');
    throw new ApiError({
      code: 'QUOTE_NO_SELECTION',
      message: 'Nenhuma opção de frete foi selecionada para esta cotação.',
      status: 400,
    });
  }

  // SECURITY: Verificar expiração
  if (quote.expiresAt < new Date()) {
    logger.warn({
      event: 'checkout_quote_expired',
      quoteId,
      userId,
      expiresAt: quote.expiresAt,
    }, 'Quote has expired');
    throw new ApiError({
      code: 'QUOTE_EXPIRED',
      message: 'Esta cotação expirou. Por favor, faça uma nova cotação.',
      status: 400,
    });
  }

  const serverFreightCostCents = quote.selection.totalCents;
  const serverFreightCost = serverFreightCostCents / 100;

  // SECURITY: Log se o cliente tentou enviar um valor diferente
  if (clientFreightCost !== undefined) {
    const clientCents = Math.round(clientFreightCost * 100);
    if (clientCents !== serverFreightCostCents) {
      logger.warn({
        event: 'checkout_price_mismatch',
        quoteId,
        userId,
        clientFreightCost,
        clientCents,
        serverFreightCost,
        serverFreightCostCents,
        difference: clientCents - serverFreightCostCents,
      }, 'SECURITY: Client sent different freight cost than server quote');
    }
  }

  // Extract externalServiceId from the selected option metadata (for Loggi)
  const selectedOption = quote.options.find((o) => o.id === quote.selection!.optionId);
  const optionMeta = selectedOption?.metadata as { externalServiceId?: string } | null;

  return {
    quoteId: quote.id,
    freightCostCents: serverFreightCostCents,
    freightCost: serverFreightCost,
    estimatedDays: quote.selection.deliveryDays,
    carrier: quote.selection.carrierName,
    service: quote.selection.serviceName,
    externalServiceId: optionMeta?.externalServiceId,
  };
}

/**
 * Valida se há pelo menos 1 item válido no documento
 */
export function validateDocumentHasItems(document: CheckoutDocument): boolean {
  if (document.type === 'DECLARACAO') {
    // Formato novo: volumeDeclarations
    if (document.volumeDeclarations && document.volumeDeclarations.length > 0) {
      return document.volumeDeclarations.some((volDecl) =>
        volDecl.items && volDecl.items.length > 0 &&
        volDecl.items.some((item) => item.descricao && item.descricao.trim().length > 0)
      );
    }
    // Formato legado: declarationItems
    if (document.declarationItems && document.declarationItems.length > 0) {
      return document.declarationItems.some(
        (item) => item.descricao && item.descricao.trim().length > 0
      );
    }
  } else if (document.type === 'NFE') {
    // Formato novo: packages (NF por pacote com items)
    if (document.packages && document.packages.length > 0) {
      return document.packages.some((pkg) => pkg.items && pkg.items.length > 0);
    }
    // Formato legado: nfeKeys (apenas chaves)
    if (document.nfeKeys && document.nfeKeys.length > 0) {
      return document.nfeKeys.some((k) => k.chave && k.chave.trim().length > 0);
    }
  }
  return false;
}

/**
 * Calcula o valor declarado baseado nos itens do documento
 */
export function calculateDeclaredValue(document: CheckoutDocument, insuranceValue?: number): number {
  let declaredValue = insuranceValue ?? 0;

  if (document.type === 'DECLARACAO') {
    // Novo formato: declaração por volume
    if (document.volumeDeclarations && document.volumeDeclarations.length > 0) {
      declaredValue = document.volumeDeclarations.reduce((totalSum, volDecl) => {
        const volumeTotal = volDecl.items.reduce((itemSum, item) =>
          itemSum + (item.valorUnitario * item.quantidade), 0
        );
        return totalSum + volumeTotal;
      }, 0);
    }
    // Formato legado: declaração única
    else if (document.declarationItems) {
      declaredValue = document.declarationItems.reduce((sum, item) =>
        sum + (item.valorUnitario * item.quantidade), 0
      );
    }
  } else if (document.type === 'NFE') {
    // Novo formato: packages (NF por pacote)
    if (document.packages && document.packages.length > 0) {
      declaredValue = document.packages.reduce((totalSum, pkg) => {
        const packageTotal = pkg.items.reduce((itemSum, item) =>
          itemSum + (item.valorTotal || (item.valorUnitario * item.quantidade)), 0
        );
        return totalSum + packageTotal;
      }, 0);
    }
    // Formato legado: nfeItems
    else if (document.nfeItems && document.nfeItems.length > 0) {
      declaredValue = document.nfeItems.reduce((sum, item) =>
        sum + (item.valorTotal || (item.valorUnitario * item.quantidade)), 0
      );
    }
  }

  return declaredValue;
}

/**
 * Prepara os dados do documento para persistência (remove undefined, organiza estrutura)
 */
export function prepareDocumentData(document: CheckoutDocument): Prisma.InputJsonValue {
  const documentData: Record<string, unknown> = {
    type: document.type,
  };

  if (document.type === 'NFE') {
    if (document.packages && document.packages.length > 0) {
      documentData.packages = document.packages;
    } else if (document.nfeKeys && document.nfeKeys.length > 0) {
      documentData.nfeKeys = document.nfeKeys.map(k => k.chave);
    }
    if (document.nfeItems && document.nfeItems.length > 0) {
      documentData.nfeItems = document.nfeItems;
    }
  } else if (document.type === 'DECLARACAO') {
    if (document.volumeDeclarations && document.volumeDeclarations.length > 0) {
      documentData.volumeDeclarations = document.volumeDeclarations;
    } else if (document.declarationItems) {
      documentData.declarationItems = document.declarationItems;
    }
  }

  // Limpar valores undefined (Prisma JSON não aceita undefined)
  return JSON.parse(JSON.stringify(documentData)) as Prisma.InputJsonValue;
}

/**
 * Gera um código de rastreamento único para a plataforma
 */
export function generatePlatformTrackingCode(): string {
  return `EL${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

/**
 * Determina o status inicial do shipment baseado no tipo de coleta
 */
export function determineInitialStatus(solicitarColeta?: boolean, pickupPointId?: string | null): ShipmentStatus {
  if (solicitarColeta === true) {
    return ShipmentStatus.PICKUP_REQUESTED;
  }
  // Fallback padrão para ambos os casos
  return ShipmentStatus.AWAITING_DROP_OFF_AT_POINT;
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

/**
 * Salva destinatário como recorrente se solicitado
 */
export async function saveRecipientIfRequested(
  userId: string,
  recipient: CheckoutRecipient
): Promise<void> {
  if (!recipient.salvarRecorrente) {
    return;
  }

  const cepNormalized = recipient.cep.replace(/\D/g, '');
  const docNormalized = recipient.documento?.replace(/\D/g, '') || null;
  const nameSearch = recipient.nome.toLowerCase().trim();

  try {
    await prisma.recipient.create({
      data: {
        userId,
        name: recipient.nome,
        nameSearch,
        email: recipient.email || null,
        phone: recipient.telefone || null,
        document: docNormalized,
        cep: cepNormalized,
        logradouro: recipient.logradouro || '',
        numero: recipient.numero || '',
        complemento: recipient.complemento || null,
        bairro: recipient.bairro || '',
        cidade: recipient.cidade,
        uf: recipient.uf,
        notes: recipient.observacoes || null,
        isDefault: false,
      },
    });
  } catch (error) {
    logger.error({ event: 'checkout_recipient_save_error', err: error }, 'Error saving recurring recipient');
  }
}

/**
 * Processa o checkout criando shipment, label, integração com transportadora e eventos
 */
export async function processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  // SECURITY FIX F-01: Validar cotação e obter preço do servidor
  // O preço do cliente é ignorado - usamos SEMPRE o preço da cotação salva
  const validatedQuote = await validateQuoteAndGetPrice(
    input.quoteId,
    input.userId,
    input.freightCost // Passamos para logging de tentativas de manipulação
  );

  // Usar valores validados do servidor
  const serverFreightCost = validatedQuote.freightCost;
  const serverEstimatedDays = validatedQuote.estimatedDays;

  // Pass carrier-specific external service ID (e.g. Loggi)
  input.externalServiceId = validatedQuote.externalServiceId;

  const platformTrackingCode = generatePlatformTrackingCode();
  const declaredValue = calculateDeclaredValue(input.document, input.insuranceValue);
  const documentData = prepareDocumentData(input.document);
  const initialStatus = determineInitialStatus(input.solicitarColeta, input.pickupPointId);

  const result = await prisma.$transaction(async (tx) => {
    // IDEMPOTÊNCIA: Verificar se já existe um shipment para este checkout
    const recentShipments = await tx.shipment.findMany({
      where: {
        senderId: input.userId,
        carrier: input.carrier,
        service: input.service,
        originCep: input.originCep,
        destinationCep: input.destinationCep,
        freightCost: serverFreightCost, // SECURITY: Usar valor do servidor
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
        },
      },
      include: {
        label: true,
        pickupRequest: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });

    if (recentShipments.length > 0) {
      const existingShipment = recentShipments[0];
      logger.info({ event: 'checkout_idempotent', shipmentId: existingShipment.id }, 'Returning existing shipment (idempotent)');

      return {
        shipmentId: existingShipment.id,
        trackingCode: existingShipment.platformTrackingCode,
        publicTrackingId: existingShipment.publicTrackingId,
        labelId: existingShipment.label?.id || '',
        pickupRequestId: existingShipment.pickupRequest?.id || null,
        isIdempotent: true,
      };
    }

    // Garantir que a carteira existe
    let wallet = await tx.wallet.findUnique({
      where: { userId: input.userId },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          userId: input.userId,
          availableCents: 0,
          pendingCents: 0,
        },
      });
    }

    // Comissoes: este caminho tambem nao registrava nenhuma. Mesma conta dos
    // demais fluxos — a de seguro sai do preco antes do calculo reverso da de
    // frete, para a de frete nao incidir duas vezes sobre ela.
    const carrierSlug = resolveCarrierSlugByName(input.carrier) ?? '';
    const { commissionAmount: insuranceCommission } = await calculateInsuranceCommission(
      declaredValue,
      carrierSlug
    );
    const insuranceCommissionCents = Math.round(insuranceCommission * 100);
    const freightCents = Math.round(serverFreightCost * 100) - insuranceCommissionCents;
    const { shippingCommissionCents, pickupCommissionCents } = await calculateCommissionsInCents(
      freightCents,
      0,
      carrierSlug
    );

    // Criar shipment com volumes
    const { shipment, packages } = await createShipmentWithVolumes(tx, {
      shipment: {
        platformTrackingCode,
        carrierTrackingCode: null,
        senderId: input.userId,
        recipientName: input.recipient.nome,
        recipientPhone: input.recipient.telefone ?? null,
        recipientEmail: input.recipient.email ?? null,
        recipientDocument: input.recipient.documento ?? null,
        originCep: input.originCep,
        originAddress: [
          input.originAddress?.logradouro,
          input.originAddress?.numero,
          input.originAddress?.complemento,
        ].filter(Boolean).join(', ') || null,
        originNeighborhood: input.originAddress?.bairro ?? null,
        originCity: input.originAddress?.cidade ?? input.originCidade ?? null,
        originState: input.originAddress?.uf ?? input.originUf ?? null,
        destinationCep: input.destinationCep,
        destinationAddress: [
          input.recipient.logradouro,
          input.recipient.numero,
          input.recipient.complemento,
        ].filter(Boolean).join(', ') || null,
        destinationNeighborhood: input.recipient.bairro ?? null,
        destinationCity: input.recipient.cidade,
        destinationState: input.recipient.uf,
        declaredValue,
        carrier: input.carrier,
        service: input.service,
        estimatedDays: serverEstimatedDays, // SECURITY: Usar valor do servidor
        freightCost: serverFreightCost, // SECURITY: Usar valor do servidor
        pickupPointId: input.pickupPointId,
        platformShippingCommissionCents: shippingCommissionCents > 0 ? shippingCommissionCents : null,
        platformPickupCommissionCents: pickupCommissionCents > 0 ? pickupCommissionCents : null,
        platformInsuranceCommissionCents: insuranceCommissionCents > 0 ? insuranceCommissionCents : null,
        document: documentData,
        status: initialStatus,
        paymentMethod: null,
      },
      volumes: input.volumes.map((vol) => ({
        peso: vol.peso,
        altura: vol.altura,
        largura: vol.largura,
        comprimento: vol.comprimento,
      })),
    });

    // Criar etiqueta vinculada ao shipment
    const label = await tx.label.create({
      data: {
        shipmentId: shipment.id,
        carrier: input.carrier,
        service: input.service,
        status: 'pending',
        priceCents: validatedQuote.freightCostCents, // SECURITY: Usar valor do servidor (já em centavos)
        currency: 'BRL',
        trackingCode: platformTrackingCode,
        recipientName: input.recipient.nome,
        isPrinted: false,
      },
    });

    // Integração com transportadora (best-effort)
    await integrateWithCarrierSafely(tx, input, shipment.id, packages, declaredValue);

    // Criar PickupRequest se solicitado
    let pickupRequestId: string | null = null;
    if (input.solicitarColeta) {
      const pickupRequest = await createPickupRequestIfNeeded(tx, input, shipment.id);
      pickupRequestId = pickupRequest?.id || null;
    }

    // Eventos de rastreamento virão dos Correios via webhook/sync
    // Não criar evento inicial genérico - API pública tem fallback para timeline vazia

    return {
      shipmentId: shipment.id,
      trackingCode: shipment.platformTrackingCode,
      publicTrackingId: shipment.publicTrackingId,
      labelId: label.id,
      pickupRequestId,
      isIdempotent: false,
    };
  });

  // Enfileirar LABEL_GENERATE para carriers não-Correios (Loggi, J&T, etc.)
  // O label worker busca o PDF da etiqueta via API da transportadora
  if (!result.isIdempotent && !isCorreiosCarrier(input.carrier)) {
    try {
      const labelQueue = getQueue<LabelGenerateJobPayload>(QUEUE_NAMES.LABEL_GENERATE);
      // Loggi async-shipments: etiqueta só fica disponível após processamento async (~1min)
      const isLoggi = input.carrier.toLowerCase() === 'loggi';
      await labelQueue.add('generate', {
        shipmentId: result.shipmentId,
        carrier: input.carrier,
      }, {
        priority: JOB_PRIORITY.HIGH,
        jobId: `label-${result.shipmentId}`,
        delay: isLoggi ? 60_000 : 0, // 60s de delay para Loggi
      });
      logger.info({
        event: 'label_generate_enqueued',
        shipmentId: result.shipmentId,
        carrier: input.carrier,
      }, 'LABEL_GENERATE job enqueued after checkout');
    } catch (err) {
      logger.warn({
        event: 'label_generate_enqueue_failed',
        shipmentId: result.shipmentId,
        error: err instanceof Error ? err.message : String(err),
      }, 'Failed to enqueue LABEL_GENERATE — label can be generated manually');
    }
  }

  // Salvar destinatário recorrente (fora da transação)
  await saveRecipientIfRequested(input.userId, input.recipient);

  // NOTA: E-mail de rastreamento é enviado após confirmação do pagamento
  // em /api/wallet/debit (não aqui, pois o shipment ainda não foi pago)

  return result;
}

/**
 * Integra com a transportadora.
 * CORREIOS: Integração OBRIGATÓRIA - lança erro se falhar
 * OUTRAS: Best-effort (não bloqueia)
 */
async function integrateWithCarrierSafely(
  tx: Prisma.TransactionClient,
  input: CheckoutInput,
  shipmentId: string,
  packages: Package[],
  declaredValue: number
): Promise<void> {
  const isCorreios = isCorreiosCarrier(input.carrier);

  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      name: true,
      razaoSocial: true,
      email: true,
      phone: true,
      cpf: true,
      cnpj: true,
    },
  });

  const originData = input.originAddress || {
    cep: input.originCep,
    cidade: input.originCidade,
    uf: input.originUf,
  };

  const senderDocumento =
    (user?.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) ||
    user?.cpf ||
    '';

  const senderData = {
    nome: user?.razaoSocial || user?.name || 'Remetente',
    documento: senderDocumento.replace(/\D/g, ''),
    telefone: user?.phone || undefined,
    email: user?.email || undefined,
    cep: (originData.cep || input.originCep).replace(/\D/g, ''),
    logradouro: originData.logradouro || undefined,
    numero: originData.numero || undefined,
    complemento: originData.complemento || undefined,
    bairro: originData.bairro || undefined,
    cidade: originData.cidade || input.originCidade || undefined,
    uf: originData.uf || input.originUf || undefined,
  };

  const recipientData = {
    nome: input.recipient.nome,
    documento: input.recipient.documento || undefined,
    telefone: input.recipient.telefone || undefined,
    email: input.recipient.email || undefined,
    cep: input.recipient.cep.replace(/\D/g, ''),
    logradouro: input.recipient.logradouro || '',
    numero: input.recipient.numero || undefined,
    complemento: input.recipient.complemento || undefined,
    bairro: input.recipient.bairro || undefined,
    cidade: input.recipient.cidade,
    uf: input.recipient.uf,
  };

  const integrationResult = await integrateWithCarrier(tx, {
    shipmentId,
    carrier: input.carrier,
    serviceName: input.service,
    serviceCode: input.externalServiceId,
    packages,
    sender: senderData,
    recipient: recipientData,
    declaredValue,
    contentDescription: 'Mercadorias diversas',
  });

  if (!integrationResult.success) {
    if (isCorreios) {
      // CORREIOS: Integração OBRIGATÓRIA
      logger.error({
        event: 'checkout_correios_failed_required',
        shipmentId,
        carrier: input.carrier,
        errorMessage: integrationResult.errorMessage,
      }, 'Correios integration failed - transaction will be rolled back');

      throw Object.assign(
        new Error(
          integrationResult.errorMessage ||
          'Não foi possível gerar a pré-postagem nos Correios. Por favor, tente novamente.'
        ),
        { code: 'CARRIER_INTEGRATION_FAILED' }
      );
    } else {
      // OUTRAS TRANSPORTADORAS: Best-effort
      logger.warn({
        event: 'checkout_carrier_failed',
        shipmentId,
        carrier: input.carrier,
        errorMessage: integrationResult.errorMessage,
      }, 'Carrier integration failed (non-blocking for non-Correios)');
    }
    return;
  }

  logger.info({
    event: 'checkout_carrier_success',
    shipmentId,
    carrier: input.carrier,
    primaryTrackingCode: integrationResult.primaryTrackingCode,
    packagesUpdated: integrationResult.packageUpdates?.length || 0,
  }, 'Carrier integration successful');
}

/**
 * Cria PickupRequest se não existir (idempotente)
 */
async function createPickupRequestIfNeeded(
  tx: Prisma.TransactionClient,
  input: CheckoutInput,
  shipmentId: string
): Promise<{ id: string } | null> {
  const existingPickup = await tx.pickupRequest.findUnique({
    where: { shipmentId },
  });

  if (existingPickup) {
    return existingPickup;
  }

  return tx.pickupRequest.create({
    data: {
      userId: input.userId,
      shipmentId,
      originCep: input.originCep,
      originAddress: null,
      originCity: input.originCidade || null,
      originUf: input.originUf || null,
      status: 'PENDING',
      notes: null,
    },
  });
}
