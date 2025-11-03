import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  CreateCarrierServiceInput,
  UpdateCarrierServiceInput,
} from '@/lib/validation/integrations-carriers';
import type { CarrierService } from '@prisma/client';

/**
 * Service for managing carrier services (PAC, SEDEX, etc)
 */

/**
 * Create carrier service
 */
export async function createCarrierService(
  data: CreateCarrierServiceInput
): Promise<CarrierService> {
  // Check if carrier exists
  const carrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId },
  });

  if (!carrier) {
    throw new Error('Carrier not found');
  }

  // Check if service ID already exists for this carrier
  const existing = await prisma.carrierService.findFirst({
    where: {
      carrierId: data.carrierId,
      serviceId: data.serviceId,
    },
  });

  if (existing) {
    throw new Error('Service ID already exists for this carrier');
  }

  const service = await prisma.carrierService.create({
    data: {
      carrierId: data.carrierId,
      serviceId: data.serviceId,
      name: data.name,
      type: data.type,
      isActive: data.isActive !== undefined ? data.isActive : true,
      minDays: data.minDays || null,
      maxDays: data.maxDays || null,
      requiresInsurance: data.requiresInsurance !== undefined ? data.requiresInsurance : false,
      metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  return service;
}

/**
 * Update carrier service
 */
export async function updateCarrierService(
  id: string,
  data: UpdateCarrierServiceInput
): Promise<CarrierService> {
  const existing = await prisma.carrierService.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Service not found');
  }

  // If updating serviceId, check for duplicates
  if (data.serviceId && data.serviceId !== existing.serviceId) {
    const duplicate = await prisma.carrierService.findFirst({
      where: {
        carrierId: existing.carrierId,
        serviceId: data.serviceId,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new Error('Service ID already exists for this carrier');
    }
  }

  const service = await prisma.carrierService.update({
    where: { id },
    data: {
      ...(data.serviceId ? { serviceId: data.serviceId } : {}),
      ...(data.name ? { name: data.name } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.minDays !== undefined ? { minDays: data.minDays } : {}),
      ...(data.maxDays !== undefined ? { maxDays: data.maxDays } : {}),
      ...(data.requiresInsurance !== undefined ? { requiresInsurance: data.requiresInsurance } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
    },
  });

  return service;
}

/**
 * Get service by ID
 */
export async function getCarrierService(id: string): Promise<CarrierService | null> {
  return await prisma.carrierService.findUnique({
    where: { id },
  });
}

/**
 * List services for a carrier
 */
export async function listCarrierServices(
  carrierId: string,
  isActive?: boolean
): Promise<CarrierService[]> {
  return await prisma.carrierService.findMany({
    where: {
      carrierId,
      ...(isActive !== undefined && { isActive }),
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Delete service
 */
export async function deleteCarrierService(id: string): Promise<void> {
  await prisma.carrierService.delete({
    where: { id },
  });
}

/**
 * Get active services for a carrier
 */
export async function getActiveCarrierServices(carrierId: string): Promise<CarrierService[]> {
  return await prisma.carrierService.findMany({
    where: {
      carrierId,
      isActive: true,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}
