import { prisma } from '@/platform/db/db';
import {
  type QuoteRequest,
  type QuoteSelectionRequest,
  calculateCubicWeight,
  calculateQuoteExpiration,
  normalizeCep,
  validateQuoteBusinessRules,
} from '@/shared/validation/quote-backend';
import type {
  QuoteResultItem,
  QuoteSummary,
  QuoteSelectionResponse,
  PartnerPoint,
} from '@/shared/types/quote';
import type { Quote, QuoteStatus } from '@prisma/client';
import {
  quoteFromCorreios,
  isCorreiosAvailableAsync,
} from '@/platform/integrations/correios';
import { applyShippingCommission } from './commission';
import {
  getEligibilityService,
  type EligibilityService,
} from '@/platform/integrations/shared/eligibility-service';
import {
  type VolumeInput,
  type QuoteEligibilityResult,
  type EligibilityApiResponse,
  toEligibilityApiResponse,
} from '@/platform/integrations/shared/volume-eligibility';

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
  eligibility?: EligibilityApiResponse;
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
// Quote Calculation - With Eligibility Check
// ============================================================================

/**
 * Resultado interno do cálculo de opções de frete
 */
type ShippingOptionsResult = {
  results: QuoteResultItem[];
  eligibility: QuoteEligibilityResult;
};

/**
 * Calcula cotações verificando elegibilidade por transportadora
 *
 * Nova arquitetura:
 * 1. Avalia elegibilidade de cada transportadora para todos os volumes
 * 2. Só chama API de transportadoras elegíveis
 * 3. Retorna informações de elegibilidade para feedback ao usuário
 */
async function calculateShippingOptions(
  request: QuoteRequest
): Promise<ShippingOptionsResult> {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  console.info(`[QUOTE][${requestId}] Starting quote with eligibility check`, {
    origin: request.origem.cep,
    dest: request.destino.cep,
    volumes: request.volumes.length,
  });

  // 1. Converter volumes para formato de validação
  const volumeInputs: VolumeInput[] = request.volumes.map((vol, index) => ({
    index,
    comprimentoCm: vol.comprimentoCm,
    larguraCm: vol.larguraCm,
    alturaCm: vol.alturaCm,
    pesoKg: vol.pesoKg,
  }));

  // 2. Avaliar elegibilidade de todas transportadoras
  const eligibilityService = getEligibilityService();
  const eligibility = eligibilityService.evaluateEligibility(volumeInputs);

  console.info(`[QUOTE][${requestId}] Eligibility evaluated`, {
    hasBlockingVolumes: eligibility.hasBlockingVolumes,
    blockingIndexes: eligibility.blockingVolumeIndexes,
    carriers: eligibility.carriers.map((c) => ({
      id: c.carrierId,
      eligible: c.isEligible,
    })),
  });

  // 3. Se há volumes bloqueantes (nenhuma transportadora aceita), retornar vazio
  if (eligibility.hasBlockingVolumes) {
    console.warn(`[QUOTE][${requestId}] Blocking volumes found`, {
      blockingIndexes: eligibility.blockingVolumeIndexes,
      reasons: eligibility.volumes
        .filter((v) => !v.hasAnyCarrier)
        .map((v) => ({ index: v.volumeIndex, reasons: v.consolidatedReasons })),
    });

    return {
      results: [],
      eligibility,
    };
  }

  // 4. Cotar apenas transportadoras elegíveis
  const results: QuoteResultItem[] = [];

  // Correios
  const correiosEligibility = eligibility.carriers.find(
    (c) => c.carrierId === 'correios'
  );

  if (correiosEligibility?.isEligible) {
    // Verificar se integração está configurada
    const isAvailable = await isCorreiosAvailableAsync();

    if (isAvailable) {
      try {
        const correiosResult = await quoteFromCorreios(request);

        if (correiosResult.results.length > 0) {
          results.push(...correiosResult.results);
        }

        console.info(`[QUOTE][${requestId}] Correios quote completed`, {
          results: correiosResult.results.length,
        });
      } catch (error) {
        console.error(`[QUOTE][${requestId}] Correios quote failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Não propaga erro - outras transportadoras podem ter sucesso
      }
    } else {
      console.warn(`[QUOTE][${requestId}] Correios not configured`);
    }
  } else {
    console.info(`[QUOTE][${requestId}] Correios not eligible`, {
      reasons: correiosEligibility?.overallReasons || [],
    });
  }

  // J&T Express
  const jtEligibility = eligibility.carriers.find(
    (c) => c.carrierId === 'jt'
  );

  if (jtEligibility?.isEligible) {
    const { isJTAvailableAsync, quoteFromJT } = await import(
      '@/platform/integrations/jt'
    );
    const isAvailable = await isJTAvailableAsync();

    if (isAvailable) {
      try {
        const jtResult = await quoteFromJT(request);

        if (jtResult.results.length > 0) {
          results.push(...jtResult.results);
        }

        console.info(`[QUOTE][${requestId}] J&T quote completed`, {
          results: jtResult.results.length,
        });
      } catch (error) {
        console.error(`[QUOTE][${requestId}] J&T quote failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      console.warn(`[QUOTE][${requestId}] J&T not configured`);
    }
  } else if (jtEligibility) {
    console.info(`[QUOTE][${requestId}] J&T not eligible`, {
      reasons: jtEligibility.overallReasons || [],
    });
  }

  // Loggi
  const loggiEligibility = eligibility.carriers.find(
    (c) => c.carrierId === 'loggi'
  );

  if (loggiEligibility?.isEligible) {
    const { isLoggiAvailableAsync, quoteFromLoggi } = await import(
      '@/platform/integrations/loggi'
    );
    const isAvailable = await isLoggiAvailableAsync();

    if (isAvailable) {
      try {
        const loggiResult = await quoteFromLoggi(request);

        if (loggiResult.results.length > 0) {
          results.push(...loggiResult.results);
        }

        console.info(`[QUOTE][${requestId}] Loggi quote completed`, {
          results: loggiResult.results.length,
        });
      } catch (error) {
        console.error(`[QUOTE][${requestId}] Loggi quote failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      console.warn(`[QUOTE][${requestId}] Loggi not configured`);
    }
  } else if (loggiEligibility) {
    console.info(`[QUOTE][${requestId}] Loggi not eligible`, {
      reasons: loggiEligibility.overallReasons || [],
    });
  }

  const duration = Date.now() - startTime;
  console.info(`[QUOTE][${requestId}] Quote completed (${duration}ms)`, {
    totalResults: results.length,
  });

  return {
    results,
    eligibility,
  };
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

  // Calculate shipping options with eligibility check
  const shippingResult = await calculateShippingOptions(request);

  // Apply carrier commission to all shipping options
  const optionsWithCommission = await Promise.all(
    shippingResult.results.map(async (option) => {
      // Determinar o carrierSlug baseado no ID da opção
      const carrierSlug = option.id.startsWith('loggi-') ? 'loggi'
        : option.id.startsWith('jt-') ? 'jt'
        : option.carrier.toLowerCase().includes('correio') ? 'correios'
        : 'correios';
      const { finalPrice, commissionAmount } = await applyShippingCommission(option.preco, carrierSlug);
      return {
        ...option,
        precoBase: option.preco, // Preco original da transportadora
        preco: finalPrice, // Preco final com comissao
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
    eligibility: toEligibilityApiResponse(shippingResult.eligibility),
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
