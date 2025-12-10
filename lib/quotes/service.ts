import { prisma } from '@/lib/db';
import {
  type QuoteRequest,
  type QuoteSelectionRequest,
  calculateCubicWeight,
  calculateQuoteExpiration,
  normalizeCep,
  validateQuoteBusinessRules,
} from '@/lib/validation/quote-backend';
import type {
  QuoteResultItem,
  QuoteSummary,
  QuoteSelectionResponse,
  PartnerPoint,
} from '@/types/quote';
import type { Quote, QuoteStatus } from '@prisma/client';
import {
  quoteFromCorreios,
  isCorreiosAvailableAsync,
} from '@/lib/integrations/correios';
import { applyShippingCommission } from './commission';

/**
 * Service layer for quotation operations
 * Handles all business logic for quotes, including calculation, persistence, and state management
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateQuoteResult = {
  quoteId: string;
  createdAt: string;
  expiresAt: string;
  resumo: QuoteSummary;
  results: QuoteResultItem[];
  pontosParceiros?: PartnerPoint[];
};

export type QuoteDetail = Quote & {
  volumes: Array<{
    id: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    cubicWeight: number;
  }>;
  options: Array<{
    id: string;
    carrierId: string;
    carrierName: string;
    serviceId: string;
    serviceName: string;
    basePriceCents: number;
    insuranceCents: number;
    additionalCents: number;
    discountCents: number;
    totalCents: number;
    deliveryDays: number;
    metadata: unknown;
  }>;
  selection?: {
    id: string;
    optionId: string;
    carrierName: string;
    serviceName: string;
    totalCents: number;
    deliveryDays: number;
    selectedAt: Date;
  } | null;
};

// ============================================================================
// Quote Calculation - Correios Only
// ============================================================================

/**
 * Calcula cotações usando exclusivamente a integração dos Correios
 * Retorna erro se integração não disponível
 */
async function calculateShippingOptions(
  request: QuoteRequest
): Promise<QuoteResultItem[]> {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  console.info(`[QUOTE][${requestId}] Starting Correios quote`, {
    origin: request.origem.cep,
    dest: request.destino.cep,
    volumes: request.volumes.length,
  });

  // Verificar se integração dos Correios está disponível (usando versão async para carregar config do DB)
  const isAvailable = await isCorreiosAvailableAsync();
  if (!isAvailable) {
    console.error(`[QUOTE][${requestId}] Correios integration not available`);
    throw new Error('Integração com os Correios não está configurada. Entre em contato com o suporte.');
  }

  try {
    // Chamar integração real dos Correios
    const correiosResult = await quoteFromCorreios(request);

    const duration = Date.now() - startTime;
    console.info(`[QUOTE][${requestId}] Correios quote completed (${duration}ms)`, {
      source: correiosResult.source,
      results: correiosResult.results.length,
      error: correiosResult.error,
    });

    // Se obteve resultados, retornar
    if (correiosResult.results.length > 0) {
      return correiosResult.results;
    }

    // Se não teve resultados, verificar qual foi o erro
    const errorMessage = correiosResult.error || 'Nenhuma opção de frete disponível para este trecho';

    // Traduzir erros comuns para mensagens amigáveis
    if (errorMessage.includes('INTEGRATION_DISABLED')) {
      throw new Error('Integração com os Correios não está configurada. Entre em contato com o suporte.');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      throw new Error('Tempo limite excedido ao consultar os Correios. Tente novamente.');
    }
    if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('auth')) {
      throw new Error('Erro de autenticação com os Correios. Entre em contato com o suporte.');
    }

    throw new Error(errorMessage);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[QUOTE][${requestId}] Correios quote failed (${duration}ms)`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Repassar erro para tratamento adequado
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erro ao consultar frete nos Correios. Tente novamente.');
  }
}

// ============================================================================
// Create Quote
// ============================================================================

/**
 * Creates a new quote with calculated shipping options
 */
export async function createQuote(
  userId: string,
  request: QuoteRequest
): Promise<CreateQuoteResult> {
  // Normalize CEPs
  const originCep = normalizeCep(request.origem.cep);
  const destCep = normalizeCep(request.destino.cep);

  // Calculate shipping options
  const shippingOptions = await calculateShippingOptions(request);

  // Apply platform commission to all shipping options
  const optionsWithCommission = await Promise.all(
    shippingOptions.map(async (option) => {
      const { finalPrice, commissionAmount } = await applyShippingCommission(option.preco);
      return {
        ...option,
        precoBase: option.preco, // Preço original da transportadora
        preco: finalPrice, // Preço final com comissão
        comissaoCentavos: Math.round(commissionAmount * 100),
      };
    })
  );

  // Calculate expiration time (24 hours)
  const expiresAt = calculateQuoteExpiration();

  // Create quote in database
  const quote = await prisma.quote.create({
    data: {
      userId,
      status: 'DRAFT',
      originCep,
      destCep,
      documentType: 'DECLARATION', // Default to declaration
      isReverse: request.devolucao || false,
      expiresAt,
      volumes: {
        create: request.volumes.map((vol) => ({
          height: vol.alturaCm,
          width: vol.larguraCm,
          length: vol.comprimentoCm,
          weight: vol.pesoKg,
          cubicWeight: calculateCubicWeight(
            vol.comprimentoCm,
            vol.larguraCm,
            vol.alturaCm
          ),
        })),
      },
      options: {
        create: optionsWithCommission.map((option) => ({
          carrierId: option.id.split('-')[0],
          carrierName: option.carrier,
          serviceId: option.id,
          serviceName: option.modalidade,
          basePriceCents: Math.round(option.precoBase * 100), // Preço base da transportadora
          insuranceCents: 0,
          additionalCents: option.comissaoCentavos, // Comissão registrada como adicional
          discountCents: 0,
          totalCents: Math.round(option.preco * 100), // Preço final com comissão
          deliveryDays: option.prazoDias,
          metadata: {
            exigeSeguro: option.exigeSeguro,
            platformCommissionCents: option.comissaoCentavos, // Registro explícito da comissão
          },
        })),
      },
    },
    include: {
      volumes: true,
      options: true,
    },
  });

  // Build response matching frontend contract
  const resumo: QuoteSummary = {
    origemCep: originCep,
    destinoCep: destCep,
    volumes: quote.volumes.map((vol) => ({
      id: vol.id,
      comprimentoCm: vol.length,
      larguraCm: vol.width,
      alturaCm: vol.height,
      pesoKg: Number(vol.weight),
    })),
    seguroValor: request.seguro ?? null,
    coleta: request.coleta,
    devolucao: request.devolucao,
  };

  const results: QuoteResultItem[] = quote.options.map((opt) => {
    const metadata = opt.metadata as { exigeSeguro?: boolean } | null;
    return {
      id: opt.serviceId,
      carrier: opt.carrierName,
      modalidade: opt.serviceName,
      prazoDias: opt.deliveryDays,
      preco: opt.totalCents / 100,
      exigeSeguro: metadata?.exigeSeguro ?? false,
    };
  });

  return {
    quoteId: quote.id,
    createdAt: quote.createdAt.toISOString(),
    expiresAt: quote.expiresAt.toISOString(),
    resumo,
    results,
    pontosParceiros: [], // TODO: Implement partner points lookup
  };
}

// ============================================================================
// Select Quote Option
// ============================================================================

/**
 * Selects a specific shipping option for a quote
 */
export async function selectQuoteOption(
  userId: string,
  request: QuoteSelectionRequest
): Promise<QuoteSelectionResponse> {
  // Find the quote
  const quote = await prisma.quote.findFirst({
    where: {
      id: request.quoteId,
      userId,
    },
    include: {
      options: true,
      selection: true,
    },
  });

  if (!quote) {
    throw new Error('Cotação não encontrada');
  }

  // Validate business rules
  // Allow SELECTED status (user might be changing their selection after closing the modal)
  const validStatuses = ['DRAFT', 'SELECTED'];
  const isValidStatus = validStatuses.includes(quote.status);
  const isNotExpired = validateQuoteBusinessRules.isQuoteValid(quote.expiresAt);

  if (!isValidStatus || !isNotExpired) {
    const now = new Date();
    const isExpired = now >= quote.expiresAt;
    console.error('[COTACOES_SELECIONAR] Validation failed:', {
      quoteId: quote.id,
      status: quote.status,
      expiresAt: quote.expiresAt,
      now,
      isExpired,
      statusValid: isValidStatus,
      timeValid: !isExpired,
    });

    if (isExpired) {
      throw new Error('Esta cotação expirou. Por favor, recalcule para obter novos valores.');
    }
    throw new Error('Esta cotação não pode mais ser selecionada (já foi confirmada ou cancelada)');
  }

  // Find the selected option
  const selectedOption = quote.options.find((opt) => opt.serviceId === request.serviceId);
  if (!selectedOption) {
    throw new Error('Opção de envio não encontrada');
  }

  // Delete existing selection if any
  if (quote.selection) {
    await prisma.quoteSelection.delete({
      where: { id: quote.selection.id },
    });
  }

  // Create new selection
  const selection = await prisma.quoteSelection.create({
    data: {
      quoteId: quote.id,
      optionId: selectedOption.id,
      carrierName: selectedOption.carrierName,
      serviceName: selectedOption.serviceName,
      totalCents: selectedOption.totalCents,
      deliveryDays: selectedOption.deliveryDays,
    },
  });

  // Update quote status and timestamp
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: 'SELECTED',
      selectedAt: new Date(),
    },
  });

  // Check if this option requires insurance or documents
  const metadata = selectedOption.metadata as { exigeSeguro?: boolean } | null;
  const exigeSeguro = metadata?.exigeSeguro ?? false;

  return {
    selectionId: selection.id,
    exigeDocumento: true, // Always require document for now
    exigeSeguro,
  };
}

// ============================================================================
// List Quotes
// ============================================================================

export type ListQuotesOptions = {
  page?: number;
  limit?: number;
  status?: QuoteStatus;
  sort?: 'createdAt' | 'updatedAt' | 'expiresAt';
  order?: 'asc' | 'desc';
};

export type ListQuotesResult = {
  quotes: Array<{
    id: string;
    status: QuoteStatus;
    originCep: string;
    destCep: string;
    createdAt: Date;
    expiresAt: Date;
    selectedAt: Date | null;
    totalOptions: number;
    selectedOption?: {
      carrierName: string;
      serviceName: string;
      totalCents: number;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Lists quotes for a user with pagination and filtering
 */
export async function listQuotes(
  userId: string,
  options: ListQuotesOptions = {}
): Promise<ListQuotesResult> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const sort = options.sort ?? 'createdAt';
  const order = options.order ?? 'desc';

  const where = {
    userId,
    ...(options.status && { status: options.status }),
  };

  // Get total count
  const total = await prisma.quote.count({ where });

  // Get quotes
  const quotes = await prisma.quote.findMany({
    where,
    include: {
      options: {
        select: {
          id: true,
        },
      },
      selection: {
        select: {
          carrierName: true,
          serviceName: true,
          totalCents: true,
        },
      },
    },
    orderBy: {
      [sort]: order,
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    quotes: quotes.map((q) => ({
      id: q.id,
      status: q.status,
      originCep: q.originCep,
      destCep: q.destCep,
      createdAt: q.createdAt,
      expiresAt: q.expiresAt,
      selectedAt: q.selectedAt,
      totalOptions: q.options.length,
      selectedOption: q.selection
        ? {
            carrierName: q.selection.carrierName,
            serviceName: q.selection.serviceName,
            totalCents: q.selection.totalCents,
          }
        : undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// Get Quote Details
// ============================================================================

/**
 * Gets detailed information about a specific quote
 */
export async function getQuoteDetail(userId: string, quoteId: string): Promise<QuoteDetail | null> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      userId,
    },
    include: {
      volumes: true,
      options: true,
      selection: true,
    },
  });

  if (!quote) {
    return null;
  }

  // Convert Decimal types to numbers for the response
  return {
    ...quote,
    nfeValue: quote.nfeValue ? Number(quote.nfeValue) : null,
    volumes: quote.volumes.map((vol) => ({
      id: vol.id,
      height: vol.height,
      width: vol.width,
      length: vol.length,
      weight: Number(vol.weight),
      cubicWeight: Number(vol.cubicWeight),
    })),
    options: quote.options.map((opt) => ({
      id: opt.id,
      carrierId: opt.carrierId,
      carrierName: opt.carrierName,
      serviceId: opt.serviceId,
      serviceName: opt.serviceName,
      basePriceCents: opt.basePriceCents,
      insuranceCents: opt.insuranceCents,
      additionalCents: opt.additionalCents,
      discountCents: opt.discountCents,
      totalCents: opt.totalCents,
      deliveryDays: opt.deliveryDays,
      metadata: opt.metadata,
    })),
    selection: quote.selection
      ? {
          id: quote.selection.id,
          optionId: quote.selection.optionId,
          carrierName: quote.selection.carrierName,
          serviceName: quote.selection.serviceName,
          totalCents: quote.selection.totalCents,
          deliveryDays: quote.selection.deliveryDays,
          selectedAt: quote.selection.selectedAt,
        }
      : null,
  } as QuoteDetail;
}

// ============================================================================
// Cancel Quote
// ============================================================================

/**
 * Cancels a quote
 */
export async function cancelQuote(userId: string, quoteId: string): Promise<void> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      userId,
    },
  });

  if (!quote) {
    throw new Error('Cotação não encontrada');
  }

  if (!validateQuoteBusinessRules.canCancelQuote(quote.status)) {
    throw new Error('Esta cotação não pode ser cancelada');
  }

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'CANCELED' },
  });
}

// ============================================================================
// Expire Old Quotes (Background Job)
// ============================================================================

/**
 * Expires quotes that are past their expiration time
 * Should be called periodically by a background job
 */
export async function expireOldQuotes(): Promise<number> {
  const result = await prisma.quote.updateMany({
    where: {
      status: {
        in: ['DRAFT', 'SELECTED'],
      },
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}
