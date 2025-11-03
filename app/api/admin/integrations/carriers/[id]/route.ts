export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import {
  getCarrier,
  updateCarrier,
  deleteCarrier,
} from '@/lib/integrations/carriers/carrier.service';
import {
  updateCarrierSchema,
  type UpdateCarrierInput,
} from '@/lib/validation/integrations-carriers';
import { prisma } from '@/lib/db';
import { checkAdminPermission, logAuditAction } from '../../_helpers';

/**
 * GET /api/admin/integrations/carriers/[id]
 * Get carrier by ID with relations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const carrier = await getCarrier(id);

    if (!carrier) {
      return NextResponse.json({ message: 'Transportadora não encontrada' }, { status: 404 });
    }

    return NextResponse.json(carrier);
  } catch (error) {
    console.error('[CARRIER_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar transportadora';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/integrations/carriers/[id]
 * Update carrier
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Parse and validate request
    const body = (await request.json()) as Record<string, unknown>;
    console.log('[CARRIER_PATCH] Request body:', body);
    console.log('[CARRIER_PATCH] Carrier ID:', id);

    const parsed = updateCarrierSchema.safeParse(body);

    if (!parsed.success) {
      console.log('[CARRIER_PATCH] Validation errors:', parsed.error.flatten());
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: UpdateCarrierInput = parsed.data;
    console.log('[CARRIER_PATCH] Validated data:', data);

    // Update carrier
    const carrier = await updateCarrier(id, data);
    console.log('[CARRIER_PATCH] Updated carrier:', {
      id: carrier.id,
      baseUrl: carrier.baseUrl,
      logoUrl: carrier.logoUrl,
    });

    // Audit log
    await logAuditAction(session.staffId, 'update_carrier', 'Carrier', carrier.id, data);

    return NextResponse.json(carrier);
  } catch (error) {
    console.error('[CARRIER_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar transportadora';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/integrations/carriers/[id]
 * Delete carrier
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get carrier first for audit
    const carrier = await getCarrier(id);
    if (!carrier) {
      return NextResponse.json({ message: 'Transportadora não encontrada' }, { status: 404 });
    }

    // Delete carrier (cascade will delete related records)
    await deleteCarrier(id);

    // Audit log
    await logAuditAction(session.staffId, 'delete_carrier', 'Carrier', id, {
      name: carrier.name,
      slug: carrier.slug,
    });

    return NextResponse.json({ message: 'Transportadora excluída com sucesso' });
  } catch (error) {
    console.error('[CARRIER_DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao excluir transportadora';
    return NextResponse.json({ message }, { status: 500 });
  }
}
