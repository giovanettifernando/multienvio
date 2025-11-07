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
  generateMockQuotes,
  shouldUseMockFallback,
  type CarrierCode,
} from './mocks';

/**
 * Service layer for quotation operations
 * Handles all business logic for quotes, including calculation, persistence, and state management
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type CreateQuoteResult = {
  quoteId: string;
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
// Quote Calculation with Fallback
// ============================================================================

/**
 * Tenta cotar com uma transportadora específica
 * Em caso de falha de integração, retorna mock
 */
async function quoteCarrier(
  carrier: CarrierCode,
  request: QuoteRequest
): Promise<{ results: QuoteResultItem[]; source: 'real' | 'mock'; error?: string }> {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    // TODO: Aqui entraria a integração real com cada transportadora
    // Por enquanto, simulamos com erro para demonstrar o fallback
    console.info(`[QUOTE][${requestId}] Attempting real quote for ${carrier}`, {
      origin: request.origem.cep,
      dest: request.destino.cep,
      volumes: request.volumes.length,
    });

    // Simula integração não configurada para demonstrar fallback
    // Em produção, isso seria substituído por:
    // const realQuotes = await realCarrierApi.quote(carrier, request);
    // return { results: realQuotes, source: 'real' };

    throw new Error('INTEGRATION_DISABLED');
  } catch (error) {
    const duration = Date.now() - startTime;
    const shouldFallback = shouldUseMockFallback(error);

    console.warn(`[QUOTE][${requestId}] Carrier ${carrier} failed (${duration}ms)`, {
      shouldFallback,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (shouldFallback) {
      // Usar mock como fallback
      const mockResults = generateMockQuotes(carrier, request);
      console.info(`[QUOTE][${requestId}] Using ${mockResults.length} mock quotes for ${carrier}`);

      return {
        results: mockResults,
        source: 'mock',
        error: error instanceof Error ? error.message : 'Integration unavailable',
      };
    }

    // Erro crítico, não usar fallback
    console.error(`[QUOTE][${requestId}] Critical error for ${carrier}, no fallback`, {
      error,
    });

    return {
      results: [],
      source: 'mock',
      error: error instanceof Error ? error.message : 'Critical error',
    };
  }
}

/**
 * Calcula cotações de todas as transportadoras com fallback automático
 */
async function calculateShippingOptions(
  request: QuoteRequest
): Promise<QuoteResultItem[]> {
  const carriers: CarrierCode[] = ['CORREIOS', 'JADLOG', 'LOGGI', 'JT'];
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.info(`[QUOTE][${requestId}] Starting quote calculation`, {
    origin: request.origem.cep,
    dest: request.destino.cep,
    carriers: carriers.length,
  });

  // Cotar todas as transportadoras em paralelo
  const quotePromises = carriers.map((carrier) => quoteCarrier(carrier, request));
  const quoteResults = await Promise.all(quotePromises);

  // Mesclar todos os resultados (reais + mocks)
  const allResults: QuoteResultItem[] = [];
  const stats = {
    real: 0,
    mock: 0,
    failed: 0,
  };

  for (const result of quoteResults) {
    if (result.results.length > 0) {
      allResults.push(...result.results);
      if (result.source === 'real') {
        stats.real += result.results.length;
      } else {
        stats.mock += result.results.length;
      }
    } else {
      stats.failed++;
    }
  }

  console.info(`[QUOTE][${requestId}] Quote calculation completed`, {
    total: allResults.length,
    real: stats.real,
    mock: stats.mock,
    failed: stats.failed,
  });

  return allResults;
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
        create: shippingOptions.map((option) => ({
          carrierId: option.id.split('-')[0],
          carrierName: option.carrier,
          serviceId: option.id,
          serviceName: option.modalidade,
          basePriceCents: Math.round(option.preco * 100),
          insuranceCents: 0,
          additionalCents: 0,
          discountCents: 0,
          totalCents: Math.round(option.preco * 100),
          deliveryDays: option.prazoDias,
          metadata: {
            exigeSeguro: option.exigeSeguro,
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
    lembrete: request.lembrete ?? null,
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
  if (!validateQuoteBusinessRules.canSelectQuote(quote.status, quote.expiresAt)) {
    throw new Error('Esta cotação não pode mais ser selecionada (expirada ou já confirmada)');
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
