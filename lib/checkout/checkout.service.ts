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
import { prisma } from '@/lib/db';
import { createShipmentWithVolumes } from '@/lib/shipments/create-with-volumes';
import { createInitialTrackingEvent } from '@/lib/tracking/create-event';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { integrateWithCarrier } from '@/lib/shipments/carrier-integration';
import { logger } from '@/lib/logger';

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
        freightCost: input.freightCost,
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
        estimatedDays: input.estimatedDays,
        freightCost: input.freightCost,
        pickupPointId: input.pickupPointId,
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
        priceCents: Math.round(input.freightCost * 100),
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

    // Criar evento inicial de rastreamento
    await createInitialTrackingEvent(tx, shipment.id, initialStatus, new Date());

    return {
      shipmentId: shipment.id,
      trackingCode: shipment.platformTrackingCode,
      publicTrackingId: shipment.publicTrackingId,
      labelId: label.id,
      pickupRequestId,
      isIdempotent: false,
    };
  });

  // Salvar destinatário recorrente (fora da transação)
  await saveRecipientIfRequested(input.userId, input.recipient);

  return result;
}

/**
 * Integra com a transportadora de forma segura (não bloqueia checkout em caso de erro)
 */
async function integrateWithCarrierSafely(
  tx: Prisma.TransactionClient,
  input: CheckoutInput,
  shipmentId: string,
  packages: Package[],
  declaredValue: number
): Promise<void> {
  try {
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
      serviceCode: undefined,
      packages,
      sender: senderData,
      recipient: recipientData,
      declaredValue,
      contentDescription: 'Mercadorias diversas',
    });

    if (integrationResult.success) {
      logger.info({
        event: 'checkout_carrier_success',
        shipmentId,
        carrier: input.carrier,
        primaryTrackingCode: integrationResult.primaryTrackingCode,
        packagesUpdated: integrationResult.packageUpdates?.length || 0,
      }, 'Carrier integration successful');
    } else {
      logger.warn({
        event: 'checkout_carrier_failed',
        shipmentId,
        carrier: input.carrier,
        errorMessage: integrationResult.errorMessage,
      }, 'Carrier integration failed (non-blocking)');
    }
  } catch (integrationError) {
    logger.error({
      event: 'checkout_carrier_error',
      shipmentId,
      carrier: input.carrier,
      err: integrationError,
    }, 'Carrier integration error (non-blocking)');
  }
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
