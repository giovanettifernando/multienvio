import { prisma } from '@/platform/db/db';
import { IntegrationStatus, IntegrationEnvironment } from '@prisma/client';
import type {
  CreatePaymentGatewayInput,
  UpdatePaymentGatewayInput,
  ListPaymentGatewaysQuery,
} from '@/shared/validation/integrations-payments';
import type { PaymentGateway } from '@prisma/client';

/**
 * Service for managing payment gateways
 */

export type PaginatedPaymentGateways = {
  gateways: Array<
    PaymentGateway & {
      _count: {
        credentials: number;
        endpoints: number;
        transactions: number;
      };
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Create payment gateway
 */
export async function createPaymentGateway(
  data: CreatePaymentGatewayInput
): Promise<PaymentGateway> {
  // Check if slug already exists
  const existing = await prisma.paymentGateway.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new Error('Payment gateway with this slug already exists');
  }

  const gateway = await prisma.paymentGateway.create({
    data: {
      name: data.name,
      slug: data.slug,
      status: data.status || 'ACTIVE',
      environment: data.environment || 'PRODUCTION',
      baseUrl: data.baseUrl || null,
      timeout: data.timeout || 30000,
      enabledMethods: data.enabledMethods || [],
      logoUrl: data.logoUrl || null,
      description: data.description || null,
    },
  });

  return gateway;
}

/**
 * Update payment gateway
 */
export async function updatePaymentGateway(
  id: string,
  data: UpdatePaymentGatewayInput
): Promise<PaymentGateway> {
  const existing = await prisma.paymentGateway.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Payment gateway not found');
  }

  // If updating slug, check for duplicates
  if (data.slug && data.slug !== existing.slug) {
    const duplicate = await prisma.paymentGateway.findUnique({
      where: { slug: data.slug },
    });

    if (duplicate) {
      throw new Error('Payment gateway with this slug already exists');
    }
  }

  const gateway = await prisma.paymentGateway.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.slug && { slug: data.slug }),
      ...(data.status && { status: data.status }),
      ...(data.environment && { environment: data.environment }),
      ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
      ...(data.timeout && { timeout: data.timeout }),
      ...(data.enabledMethods && { enabledMethods: data.enabledMethods }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  return gateway;
}

/**
 * Get payment gateway by ID
 */
export async function getPaymentGateway(id: string): Promise<
  | (PaymentGateway & {
      _count: {
        credentials: number;
        endpoints: number;
        transactions: number;
      };
    })
  | null
> {
  return await prisma.paymentGateway.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          credentials: true,
          endpoints: true,
          transactions: true,
        },
      },
    },
  });
}

/**
 * List payment gateways with pagination
 */
export async function listPaymentGateways(
  query: ListPaymentGatewaysQuery
): Promise<PaginatedPaymentGateways> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: {
    status?: IntegrationStatus;
    environment?: IntegrationEnvironment;
  } = {};

  if (query.status) where.status = query.status as IntegrationStatus;
  if (query.environment) where.environment = query.environment as IntegrationEnvironment;

  const [gateways, total] = await Promise.all([
    prisma.paymentGateway.findMany({
      where,
      include: {
        _count: {
          select: {
            credentials: true,
            endpoints: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.paymentGateway.count({ where }),
  ]);

  return {
    gateways,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Delete payment gateway
 */
export async function deletePaymentGateway(id: string): Promise<void> {
  const existing = await prisma.paymentGateway.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Payment gateway not found');
  }

  // Prevent deletion if there are transactions
  if (existing._count.transactions > 0) {
    throw new Error(
      'Cannot delete payment gateway with existing transactions. Set status to INACTIVE instead.'
    );
  }

  await prisma.paymentGateway.delete({
    where: { id },
  });
}

/**
 * Get payment gateway by slug
 */
export async function getPaymentGatewayBySlug(slug: string): Promise<PaymentGateway | null> {
  return await prisma.paymentGateway.findUnique({
    where: { slug },
  });
}

/**
 * Test connection to payment gateway
 */
export async function testPaymentGatewayConnection(
  gatewayId: string,
  environment: 'SANDBOX' | 'PRODUCTION'
): Promise<{ success: boolean; message: string; latency?: number }> {
  const gateway = await prisma.paymentGateway.findUnique({
    where: { id: gatewayId },
    include: {
      credentials: {
        where: {
          isActive: true,
          environment,
        },
        take: 1,
      },
    },
  });

  if (!gateway) {
    return {
      success: false,
      message: 'Payment gateway not found',
    };
  }

  if (!gateway.baseUrl) {
    return {
      success: false,
      message: 'Base URL not configured',
    };
  }

  if (gateway.credentials.length === 0) {
    return {
      success: false,
      message: `No active credentials found for ${environment} environment`,
    };
  }

  // Test connection by making a simple health check request
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), gateway.timeout);

    const response = await fetch(`${gateway.baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const latency = Date.now() - startTime;

    if (response.ok) {
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

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: `Connection timeout after ${gateway.timeout}ms`,
          latency,
        };
      }

      return {
        success: false,
        message: error.message,
        latency,
      };
    }

    return {
      success: false,
      message: 'Unknown error occurred',
      latency,
    };
  }
}
