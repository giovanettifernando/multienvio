export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  createCarrierPricingRule,
  listCarrierPricingRules,
} from '@/lib/integrations/carriers/carrier-pricing.service';
import {
  createCarrierPricingRuleSchema,
  type CreateCarrierPricingRuleInput,
} from '@/lib/validation/integrations-carriers';

/**
 * POST /api/admin/integrations/carriers/[id]/pricing-rules
 * Create new pricing rule for carrier
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { id } = await params;

    // Verify carrier exists
    const carrier = await prisma.carrier.findUnique({
      where: { id },
    });

    if (!carrier) {
      return NextResponse.json({ message: 'Transportadora não encontrada' }, { status: 404 });
    }

    // Parse body
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = createCarrierPricingRuleSchema.safeParse({
      ...body,
      carrierId: id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: CreateCarrierPricingRuleInput = parsed.data;
    const rule = await createCarrierPricingRule(data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'create_carrier_pricing_rule',
        entity: 'CarrierPricingRule',
        entityId: rule.id,
        data: {
          carrierId: id,
          name: rule.name,
          serviceId: rule.serviceId,
          priority: rule.priority,
        },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('[CARRIER_PRICING_RULES_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar regra de preço';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/admin/integrations/carriers/[id]/pricing-rules
 * List pricing rules for carrier
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { session } = authResult;

    const { id } = await params;

    // Verify carrier exists
    const carrier = await prisma.carrier.findUnique({
      where: { id },
    });

    if (!carrier) {
      return NextResponse.json({ message: 'Transportadora não encontrada' }, { status: 404 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const isActive = url.searchParams.get('isActive');
    const serviceId = url.searchParams.get('serviceId');

    const rules = await listCarrierPricingRules(
      id,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      serviceId || undefined
    );

    return NextResponse.json(rules);
  } catch (error) {
    console.error('[CARRIER_PRICING_RULES_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar regras de preço';
    return NextResponse.json({ message }, { status: 500 });
  }
}
