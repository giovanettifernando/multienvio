export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import {
  createCarrier,
  listCarriers,
} from '@/lib/integrations/carriers/carrier.service';
import {
  createCarrierSchema,
  listCarriersQuerySchema,
  type CreateCarrierInput,
} from '@/lib/validation/integrations-carriers';
import { checkAdminPermission, logAuditAction } from '../_helpers';

/**
 * POST /api/admin/integrations/carriers
 * Create a new carrier integration
 */
export async function POST(request: Request) {
  try {
    // Authenticate admin
    const session = await getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Debug log
    console.log('[CARRIERS_POST] Session:', {
      staffId: session.staffId,
      email: session.email,
      isSuperAdmin: session.isSuperAdmin,
      permissions: session.permissions,
    });

    // Check permission
    if (!checkAdminPermission(session, 'INTEGRACOES')) {
      console.log('[CARRIERS_POST] Permission denied');
      return NextResponse.json({ message: 'Sem permissão' }, { status: 403 });
    }

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
    // Authenticate admin
    const session = await getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Check permission
    if (!checkAdminPermission(session, 'INTEGRACOES')) {
      return NextResponse.json({ message: 'Sem permissão' }, { status: 403 });
    }

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

