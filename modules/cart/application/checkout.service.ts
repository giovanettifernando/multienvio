import 'server-only';

/**
 * Checkout Service
 *
 * Peças comuns aos checkouts pagos (envio avulso, carrinho, frete pago pelo
 * destinatário): preço validado na cotação do servidor, documento do envio,
 * valor declarado, código de rastreio e destinatário recorrente.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { logger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';
import { conferirEnvioComCotacao, type EnvioCotado } from './cotacao-envio';

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
  /** Chave da DC-e, quando o documento é declaração de conteúdo. */
  dceKey?: string;
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
  /** Código do serviço na transportadora (ex.: 03298 = PAC) */
  serviceCode?: string;
  /** Carrier-specific external service ID (e.g. Loggi externalServiceId) */
  externalServiceId?: string;
}

export async function validateQuoteAndGetPrice(
  quoteId: string,
  userId: string,
  clientFreightCost: number | undefined,
  /** O envio que vai ser pago: precisa ser o mesmo que foi cotado */
  envio: EnvioCotado
): Promise<ValidatedQuote> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      userId: userId, // SECURITY: Verificar ownership
    },
    include: {
      selection: true,
      options: true,
      volumes: { orderBy: { id: 'asc' } },
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

  // O preço vale para o que foi cotado: CEPs, volumes e valor segurado
  conferirEnvioComCotacao(quote, envio);

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
    serviceCode: selectedOption?.serviceId,
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
 * Valor segurado do envio.
 *
 * É apenas o que o cliente escolheu no campo de seguro. A declaração de
 * conteúdo (ou a NF-e) descreve o que vai dentro da caixa e serve ao
 * documento — não define quanto está segurado.
 *
 * Antes esta função somava os itens do documento e SOBRESCREVIA o seguro
 * escolhido. Isso quebrava de dois jeitos: um envio com R$ 9.315 declarados em
 * bens saía segurado em R$ 0 num fluxo, enquanto noutro o seguro virava a soma
 * da declaração sem o cliente ter pedido. Como o valor declarado altera o
 * preço da transportadora e a nossa comissão, a conta mudava depois da
 * cotação — o cliente via um preço e pagava outro.
 *
 * O parâmetro `document` continua na assinatura porque os dois chamadores já o
 * têm em mãos, e porque uma regra futura (segurar pelo maior valor, por
 * exemplo) precisaria dele de volta.
 */
export function calculateDeclaredValue(_document: CheckoutDocument, insuranceValue?: number): number {
  return insuranceValue ?? 0;
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
  return `ME${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

/**
 * Status inicial do envio.
 *
 * Quem leva o pacote até a transportadora é o próprio cliente, então todo
 * envio nasce aguardando postagem.
 */
export function determineInitialStatus(): ShipmentStatus {
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
