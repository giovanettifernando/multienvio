import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  CreateCarrierEndpointInput,
  UpdateCarrierEndpointInput,
} from '@/lib/validation/integrations-carriers';
import type { CarrierEndpoint } from '@prisma/client';

/**
 * Service for managing carrier API endpoints
 */

/**
 * Create carrier endpoint
 */
export async function createCarrierEndpoint(
  data: CreateCarrierEndpointInput
): Promise<CarrierEndpoint> {
  // Check if carrier exists
  const carrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId },
  });

  if (!carrier) {
    throw new Error('Carrier not found');
  }

  // Check if endpoint for this operation already exists
  const existing = await prisma.carrierEndpoint.findFirst({
    where: {
      carrierId: data.carrierId,
      operation: data.operation,
    },
  });

  if (existing) {
    throw new Error(`Endpoint for operation '${data.operation}' already exists for this carrier`);
  }

  const endpoint = await prisma.carrierEndpoint.create({
    data: {
      carrierId: data.carrierId,
      operation: data.operation,
      method: data.method,
      path: data.path,
      timeout: data.timeout || null,
      retryable: data.retryable !== undefined ? data.retryable : true,
      requestMapping: (data.requestMapping as Prisma.InputJsonValue) ?? undefined,
      responseMapping: (data.responseMapping as Prisma.InputJsonValue) ?? undefined,
    },
  });

  return endpoint;
}

/**
 * Update carrier endpoint
 */
export async function updateCarrierEndpoint(
  id: string,
  data: UpdateCarrierEndpointInput
): Promise<CarrierEndpoint> {
  const existing = await prisma.carrierEndpoint.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Endpoint not found');
  }

  // If updating operation, check for duplicates
  if (data.operation && data.operation !== existing.operation) {
    const duplicate = await prisma.carrierEndpoint.findFirst({
      where: {
        carrierId: existing.carrierId,
        operation: data.operation,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new Error(`Endpoint for operation '${data.operation}' already exists for this carrier`);
    }
  }

  const endpoint = await prisma.carrierEndpoint.update({
    where: { id },
    data: {
      ...(data.operation ? { operation: data.operation } : {}),
      ...(data.method ? { method: data.method } : {}),
      ...(data.path ? { path: data.path } : {}),
      ...(data.timeout !== undefined ? { timeout: data.timeout } : {}),
      ...(data.retryable !== undefined ? { retryable: data.retryable } : {}),
      ...(data.requestMapping !== undefined ? { requestMapping: data.requestMapping as Prisma.InputJsonValue } : {}),
      ...(data.responseMapping !== undefined ? { responseMapping: data.responseMapping as Prisma.InputJsonValue } : {}),
    },
  });

  return endpoint;
}

/**
 * Get endpoint by ID
 */
export async function getCarrierEndpoint(id: string): Promise<CarrierEndpoint | null> {
  return await prisma.carrierEndpoint.findUnique({
    where: { id },
  });
}

/**
 * List endpoints for a carrier
 */
export async function listCarrierEndpoints(
  carrierId: string,
  operation?: string
): Promise<CarrierEndpoint[]> {
  return await prisma.carrierEndpoint.findMany({
    where: {
      carrierId,
      ...(operation && { operation }),
    },
    orderBy: { operation: 'asc' },
  });
}

/**
 * Delete endpoint
 */
export async function deleteCarrierEndpoint(id: string): Promise<void> {
  await prisma.carrierEndpoint.delete({
    where: { id },
  });
}

/**
 * Get endpoint by operation
 */
export async function getCarrierEndpointByOperation(
  carrierId: string,
  operation: string
): Promise<CarrierEndpoint | null> {
  return await prisma.carrierEndpoint.findFirst({
    where: {
      carrierId,
      operation,
    },
  });
}
