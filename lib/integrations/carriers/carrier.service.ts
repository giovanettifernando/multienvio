import { prisma } from '@/lib/db';
import type {
  CreateCarrierInput,
  UpdateCarrierInput,
  ListCarriersQuery,
} from '@/lib/validation/integrations-carriers';
import { maskCredentials } from '@/lib/validation/integrations-carriers';
import type { Carrier, IntegrationStatus, IntegrationEnvironment } from '@prisma/client';

/**
 * Service for managing carrier integrations
 */

export type CarrierWithRelations = Carrier & {
  services: Array<{
    id: string;
    serviceId: string;
    name: string;
    type: string;
    isActive: boolean;
  }>;
  _count: {
    endpoints: number;
    credentials: number;
    pricingRules: number;
  };
};

export type PaginatedCarriers = {
  carriers: CarrierWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Create a new carrier
 */
export async function createCarrier(data: CreateCarrierInput): Promise<Carrier> {
  // Check if slug already exists
  const existing = await prisma.carrier.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new Error('Carrier with this slug already exists');
  }

  const carrier = await prisma.carrier.create({
    data: {
      name: data.name,
      slug: data.slug,
      status: data.status || 'ACTIVE',
      environment: data.environment || 'PRODUCTION',
      baseUrl: data.baseUrl || null,
      timeout: data.timeout || 30000,
      maxRetries: data.maxRetries || 3,
      logoUrl: data.logoUrl || null,
      description: data.description || null,
    },
  });

  return carrier;
}

/**
 * Update a carrier
 */
export async function updateCarrier(id: string, data: UpdateCarrierInput): Promise<Carrier> {
  // If slug is being updated, check if it's available
  if (data.slug) {
    const existing = await prisma.carrier.findFirst({
      where: {
        slug: data.slug,
        id: { not: id },
      },
    });

    if (existing) {
      throw new Error('Carrier with this slug already exists');
    }
  }

  const carrier = await prisma.carrier.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.slug && { slug: data.slug }),
      ...(data.status && { status: data.status }),
      ...(data.environment && { environment: data.environment }),
      ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
      ...(data.timeout !== undefined && { timeout: data.timeout }),
      ...(data.maxRetries !== undefined && { maxRetries: data.maxRetries }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  return carrier;
}

/**
 * Get a carrier by ID with relations
 */
export async function getCarrier(id: string): Promise<CarrierWithRelations | null> {
  const carrier = await prisma.carrier.findUnique({
    where: { id },
    include: {
      services: {
        select: {
          id: true,
          serviceId: true,
          name: true,
          type: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      },
      _count: {
        select: {
          endpoints: true,
          credentials: true,
          pricingRules: true,
        },
      },
    },
  });

  return carrier;
}

/**
 * Get carrier by slug
 */
export async function getCarrierBySlug(slug: string): Promise<Carrier | null> {
  return prisma.carrier.findUnique({
    where: { slug },
  });
}

/**
 * List carriers with pagination and filtering
 */
export async function listCarriers(query: ListCarriersQuery): Promise<PaginatedCarriers> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: {
    status?: IntegrationStatus;
    environment?: IntegrationEnvironment;
  } = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.environment) {
    where.environment = query.environment;
  }

  const [carriers, total] = await Promise.all([
    prisma.carrier.findMany({
      where,
      include: {
        services: {
          select: {
            id: true,
            serviceId: true,
            name: true,
            type: true,
            isActive: true,
          },
          where: { isActive: true },
          take: 5,
        },
        _count: {
          select: {
            endpoints: true,
            credentials: true,
            pricingRules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.carrier.count({ where }),
  ]);

  return {
    carriers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Delete a carrier
 */
export async function deleteCarrier(id: string): Promise<void> {
  await prisma.carrier.delete({
    where: { id },
  });
}

/**
 * Get active carriers for a specific environment
 */
export async function getActiveCarriers(
  environment: IntegrationEnvironment
): Promise<Carrier[]> {
  return prisma.carrier.findMany({
    where: {
      status: 'ACTIVE',
      environment,
    },
    include: {
      services: {
        where: { isActive: true },
      },
      endpoints: true,
      credentials: {
        where: {
          isActive: true,
          environment,
        },
      },
      pricingRules: {
        where: { isActive: true },
        orderBy: { priority: 'asc' },
      },
    },
  });
}

/**
 * Test carrier connection
 */
export async function testCarrierConnection(
  carrierId: string,
  environment: IntegrationEnvironment
): Promise<{ success: boolean; message: string; latency?: number }> {
  const carrier = await prisma.carrier.findUnique({
    where: { id: carrierId },
    include: {
      credentials: {
        where: {
          isActive: true,
          environment,
        },
        take: 1,
      },
      endpoints: {
        where: { operation: 'quote' },
        take: 1,
      },
    },
  });

  if (!carrier) {
    throw new Error('Carrier not found');
  }

  if (!carrier.baseUrl) {
    return {
      success: false,
      message: 'Base URL not configured',
    };
  }

  if (carrier.credentials.length === 0) {
    return {
      success: false,
      message: 'No active credentials found for this environment',
    };
  }

  const startTime = Date.now();

  try {
    // Simple ping/health check
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), carrier.timeout);

    const response = await fetch(`${carrier.baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const latency = Date.now() - startTime;

    if (response.ok) {
      // Record successful API call
      await prisma.carrierApiCall.create({
        data: {
          carrierId: carrier.id,
          operation: 'health_check',
          method: 'GET',
          endpoint: '/health',
          statusCode: response.status,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          duration: latency,
          success: true,
        },
      });

      return {
        success: true,
        message: 'Connection successful',
        latency,
      };
    }

    return {
      success: false,
      message: `HTTP ${response.status}: ${response.statusText}`,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Record failed API call
    await prisma.carrierApiCall.create({
      data: {
        carrierId: carrier.id,
        operation: 'health_check',
        method: 'GET',
        endpoint: '/health',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: latency,
        success: false,
        errorMessage,
      },
    });

    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      latency,
    };
  }
}
