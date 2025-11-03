import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  CreateCarrierPricingRuleInput,
  UpdateCarrierPricingRuleInput,
} from '@/lib/validation/integrations-carriers';
import { validateCarrierRules } from '@/lib/validation/integrations-carriers';
import type { CarrierPricingRule } from '@prisma/client';

/**
 * Service for managing carrier pricing rules
 */

/**
 * Create pricing rule
 */
export async function createCarrierPricingRule(
  data: CreateCarrierPricingRuleInput
): Promise<CarrierPricingRule> {
  // Check if carrier exists
  const carrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId },
  });

  if (!carrier) {
    throw new Error('Carrier not found');
  }

  // Validate rule consistency
  const validation = validateCarrierRules.validatePricingRule(data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // If serviceId provided, verify it exists
  if (data.serviceId) {
    const service = await prisma.carrierService.findFirst({
      where: {
        carrierId: data.carrierId,
        serviceId: data.serviceId,
      },
    });

    if (!service) {
      throw new Error('Service not found for this carrier');
    }
  }

  const rule = await prisma.carrierPricingRule.create({
    data: {
      carrierId: data.carrierId,
      name: data.name,
      serviceId: data.serviceId || null,
      originStates: data.originStates || null,
      destStates: data.destStates || null,
      minWeight: data.minWeight || null,
      maxWeight: data.maxWeight || null,
      basePriceCents: data.basePriceCents || null,
      pricePerKg: data.pricePerKg || null,
      insurancePercent: data.insurancePercent || null,
      additionalFees: (data.additionalFees as Prisma.InputJsonValue) ?? undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      priority: data.priority !== undefined ? data.priority : 0,
    },
  });

  return rule;
}

/**
 * Update pricing rule
 */
export async function updateCarrierPricingRule(
  id: string,
  data: UpdateCarrierPricingRuleInput
): Promise<CarrierPricingRule> {
  const existing = await prisma.carrierPricingRule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Pricing rule not found');
  }

  // Build updated data for validation
  const updatedData = { ...existing, ...data };
  const validation = validateCarrierRules.validatePricingRule(updatedData as CreateCarrierPricingRuleInput);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // If updating serviceId, verify it exists
  if (data.serviceId && data.serviceId !== existing.serviceId) {
    const service = await prisma.carrierService.findFirst({
      where: {
        carrierId: existing.carrierId,
        serviceId: data.serviceId,
      },
    });

    if (!service) {
      throw new Error('Service not found for this carrier');
    }
  }

  const rule = await prisma.carrierPricingRule.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
      ...(data.originStates !== undefined && { originStates: data.originStates }),
      ...(data.destStates !== undefined ? { destStates: data.destStates } : {}),
      ...(data.minWeight !== undefined ? { minWeight: data.minWeight } : {}),
      ...(data.maxWeight !== undefined ? { maxWeight: data.maxWeight } : {}),
      ...(data.basePriceCents !== undefined ? { basePriceCents: data.basePriceCents } : {}),
      ...(data.pricePerKg !== undefined ? { pricePerKg: data.pricePerKg } : {}),
      ...(data.insurancePercent !== undefined ? { insurancePercent: data.insurancePercent } : {}),
      ...(data.additionalFees !== undefined ? { additionalFees: data.additionalFees as Prisma.InputJsonValue } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
    },
  });

  return rule;
}

/**
 * Get pricing rule by ID
 */
export async function getCarrierPricingRule(id: string): Promise<CarrierPricingRule | null> {
  return await prisma.carrierPricingRule.findUnique({
    where: { id },
  });
}

/**
 * List pricing rules for a carrier
 */
export async function listCarrierPricingRules(
  carrierId: string,
  isActive?: boolean,
  serviceId?: string
): Promise<CarrierPricingRule[]> {
  return await prisma.carrierPricingRule.findMany({
    where: {
      carrierId,
      ...(isActive !== undefined && { isActive }),
      ...(serviceId && { serviceId }),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Delete pricing rule
 */
export async function deleteCarrierPricingRule(id: string): Promise<void> {
  await prisma.carrierPricingRule.delete({
    where: { id },
  });
}

/**
 * Get applicable pricing rules for a shipment
 * Returns rules that match the criteria, sorted by priority
 */
export async function getApplicablePricingRules(
  carrierId: string,
  serviceId: string,
  originState: string,
  destState: string,
  weightKg: number
): Promise<CarrierPricingRule[]> {
  // Get all active rules for the carrier and service
  const rules = await prisma.carrierPricingRule.findMany({
    where: {
      carrierId,
      isActive: true,
      OR: [
        { serviceId },
        { serviceId: null }, // General rules
      ],
    },
    orderBy: [{ priority: 'desc' }],
  });

  // Filter rules that match the shipment criteria
  return rules.filter((rule) => {
    // Check origin states
    if (rule.originStates) {
      const origins = rule.originStates.split(',').map((s) => s.trim());
      if (!origins.includes(originState)) {
        return false;
      }
    }

    // Check dest states
    if (rule.destStates) {
      const dests = rule.destStates.split(',').map((s) => s.trim());
      if (!dests.includes(destState)) {
        return false;
      }
    }

    // Check weight range
    if (rule.minWeight !== null && weightKg < Number(rule.minWeight)) {
      return false;
    }
    if (rule.maxWeight !== null && weightKg > Number(rule.maxWeight)) {
      return false;
    }

    return true;
  });
}
