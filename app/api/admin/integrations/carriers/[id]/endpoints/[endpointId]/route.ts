export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';
import {
  getCarrierEndpoint,
  updateCarrierEndpoint,
  deleteCarrierEndpoint,
} from '@/lib/integrations/carriers/carrier-endpoint.service';
import {
  updateCarrierEndpointSchema,
  type UpdateCarrierEndpointInput,
} from '@/lib/validation/integrations-carriers';

/**
 * GET /api/admin/integrations/carriers/[id]/endpoints/[endpointId]
 * Get specific endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  try {
    // Authenticate admin
    const session = await getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Check permission
    if (!session.permissions.includes('INTEGRACOES') && !session.isSuperAdmin) {
      return NextResponse.json({ message: 'Sem permissão' }, { status: 403 });
    }

    const { id, endpointId } = await params;

    const endpoint = await getCarrierEndpoint(endpointId);

    if (!endpoint) {
      return NextResponse.json({ message: 'Endpoint não encontrado' }, { status: 404 });
    }

    // Verify it belongs to the carrier
    if (endpoint.carrierId !== id) {
      return NextResponse.json({ message: 'Endpoint não pertence a esta transportadora' }, { status: 400 });
    }

    return NextResponse.json(endpoint);
  } catch (error) {
    console.error('[CARRIER_ENDPOINT_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar endpoint';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/integrations/carriers/[id]/endpoints/[endpointId]
 * Update endpoint
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  try {
    // Authenticate admin
    const session = await getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Check permission
    if (!session.permissions.includes('INTEGRACOES') && !session.isSuperAdmin) {
      return NextResponse.json({ message: 'Sem permissão' }, { status: 403 });
    }

    const { id, endpointId } = await params;

    // Verify endpoint exists and belongs to carrier
    const existing = await prisma.carrierEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Endpoint não encontrado' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Endpoint não pertence a esta transportadora' }, { status: 400 });
    }

    // Parse body
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = updateCarrierEndpointSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: UpdateCarrierEndpointInput = parsed.data;
    const endpoint = await updateCarrierEndpoint(endpointId, data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'update_carrier_endpoint',
        entity: 'CarrierEndpoint',
        entityId: endpointId,
        data: {
          carrierId: id,
          updatedFields: Object.keys(data),
        },
      },
    });

    return NextResponse.json(endpoint);
  } catch (error) {
    console.error('[CARRIER_ENDPOINT_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar endpoint';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/integrations/carriers/[id]/endpoints/[endpointId]
 * Delete endpoint
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  try {
    // Authenticate admin
    const session = await getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Check permission
    if (!session.permissions.includes('INTEGRACOES') && !session.isSuperAdmin) {
      return NextResponse.json({ message: 'Sem permissão' }, { status: 403 });
    }

    const { id, endpointId } = await params;

    // Verify endpoint exists and belongs to carrier
    const existing = await prisma.carrierEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Endpoint não encontrado' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Endpoint não pertence a esta transportadora' }, { status: 400 });
    }

    await deleteCarrierEndpoint(endpointId);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'delete_carrier_endpoint',
        entity: 'CarrierEndpoint',
        entityId: endpointId,
        data: {
          carrierId: id,
          operation: existing.operation,
          path: existing.path,
        },
      },
    });

    return NextResponse.json({ message: 'Endpoint deletado com sucesso' });
  } catch (error) {
    console.error('[CARRIER_ENDPOINT_DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao deletar endpoint';
    return NextResponse.json({ message }, { status: 500 });
  }
}
