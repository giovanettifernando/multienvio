import { NextRequest, NextResponse } from 'next/server';

import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  createCarrierEndpoint,
  listCarrierEndpoints,
} from '@/lib/integrations/carriers/carrier-endpoint.service';
import {
  createCarrierEndpointSchema,
  type CreateCarrierEndpointInput,
} from '@/lib/validation/integrations-carriers';

/**
 * POST /api/admin/integrations/carriers/[id]/endpoints
 * Create new endpoint for carrier
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
    const parsed = createCarrierEndpointSchema.safeParse({
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

    const data: CreateCarrierEndpointInput = parsed.data;
    const endpoint = await createCarrierEndpoint(data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'create_carrier_endpoint',
        entity: 'CarrierEndpoint',
        entityId: endpoint.id,
        data: {
          carrierId: id,
          operation: endpoint.operation,
          method: endpoint.method,
          path: endpoint.path,
        },
      },
    });

    return NextResponse.json(endpoint, { status: 201 });
  } catch (error) {
    console.error('[CARRIER_ENDPOINTS_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar endpoint';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/admin/integrations/carriers/[id]/endpoints
 * List endpoints for carrier
 */
export async function GET(
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

    // Get query parameters
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');

    const endpoints = await listCarrierEndpoints(id, operation || undefined);

    return NextResponse.json(endpoints);
  } catch (error) {
    console.error('[CARRIER_ENDPOINTS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar endpoints';
    return NextResponse.json({ message }, { status: 500 });
  }
}
