export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getCarrierPricingRule,
  updateCarrierPricingRule,
  deleteCarrierPricingRule,
} from '@/lib/integrations/carriers/carrier-pricing.service';
import {
  updateCarrierPricingRuleSchema,
  type UpdateCarrierPricingRuleInput,
} from '@/lib/validation/integrations-carriers';

/**
 * GET /api/admin/integrations/carriers/[id]/pricing-rules/[ruleId]
 * Get specific pricing rule
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { session } = authResult;

    const { id, ruleId } = await params;

    const rule = await getCarrierPricingRule(ruleId);

    if (!rule) {
      return NextResponse.json({ message: 'Regra de preço não encontrada' }, { status: 404 });
    }

    // Verify it belongs to the carrier
    if (rule.carrierId !== id) {
      return NextResponse.json({ message: 'Regra não pertence a esta transportadora' }, { status: 400 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('[CARRIER_PRICING_RULE_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar regra de preço';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/integrations/carriers/[id]/pricing-rules/[ruleId]
 * Update pricing rule
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { id, ruleId } = await params;

    // Verify rule exists and belongs to carrier
    const existing = await prisma.carrierPricingRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Regra de preço não encontrada' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Regra não pertence a esta transportadora' }, { status: 400 });
    }

    // Parse body
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = updateCarrierPricingRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: UpdateCarrierPricingRuleInput = parsed.data;
    const rule = await updateCarrierPricingRule(ruleId, data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'update_carrier_pricing_rule',
        entity: 'CarrierPricingRule',
        entityId: ruleId,
        data: {
          carrierId: id,
          updatedFields: Object.keys(data),
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('[CARRIER_PRICING_RULE_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar regra de preço';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/integrations/carriers/[id]/pricing-rules/[ruleId]
 * Delete pricing rule
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { id, ruleId } = await params;

    // Verify rule exists and belongs to carrier
    const existing = await prisma.carrierPricingRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Regra de preço não encontrada' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Regra não pertence a esta transportadora' }, { status: 400 });
    }

    await deleteCarrierPricingRule(ruleId);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'delete_carrier_pricing_rule',
        entity: 'CarrierPricingRule',
        entityId: ruleId,
        data: {
          carrierId: id,
          name: existing.name,
        },
      },
    });

    return NextResponse.json({ message: 'Regra de preço deletada com sucesso' });
  } catch (error) {
    console.error('[CARRIER_PRICING_RULE_DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao deletar regra de preço';
    return NextResponse.json({ message }, { status: 500 });
  }
}
