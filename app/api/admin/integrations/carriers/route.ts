export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import {
  createCarrier,
  listCarriers,
} from '@/lib/integrations/carriers/carrier.service';
import {
  createCarrierSchema,
  listCarriersQuerySchema,
  type CreateCarrierInput,
} from '@/lib/validation/integrations-carriers';
import { logAuditAction } from '../_helpers';

/**
 * POST /api/admin/integrations/carriers
 * Create a new carrier integration
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    // Parse and validate request
    const body = (await request.json()) as Record<string, unknown>;
    console.log('[CARRIERS_POST] Request body:', body);

    const parsed = createCarrierSchema.safeParse(body);

    if (!parsed.success) {
      console.log('[CARRIERS_POST] Validation errors:', parsed.error.flatten());
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: CreateCarrierInput = parsed.data;

    // Create carrier
    const carrier = await createCarrier(data);

    // Audit log
    await logAuditAction(session.staffId, 'create_carrier', 'Carrier', carrier.id, {
      name: carrier.name,
      slug: carrier.slug,
    });

    return NextResponse.json(carrier, { status: 201 });
  } catch (error) {
    console.error('[CARRIERS_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar transportadora';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/admin/integrations/carriers
 * List all carriers with pagination and filters
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Parse query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = listCarriersQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Parâmetros inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const query = parsed.data;

    // List carriers
    const result = await listCarriers(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[CARRIERS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar transportadoras';
    return NextResponse.json({ message }, { status: 500 });
  }
}

