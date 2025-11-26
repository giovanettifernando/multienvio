export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  createCarrierService,
  listCarrierServices,
} from '@/lib/integrations/carriers/carrier-service.service';
import {
  createCarrierServiceSchema,
  type CreateCarrierServiceInput,
} from '@/lib/validation/integrations-carriers';

/**
 * POST /api/admin/integrations/carriers/[id]/services
 * Create new service for carrier
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
    const parsed = createCarrierServiceSchema.safeParse({
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

    const data: CreateCarrierServiceInput = parsed.data;
    const service = await createCarrierService(data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'create_carrier_service',
        entity: 'CarrierService',
        entityId: service.id,
        data: {
          carrierId: id,
          serviceId: service.serviceId,
          name: service.name,
          type: service.type,
        },
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error('[CARRIER_SERVICES_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar serviço';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/admin/integrations/carriers/[id]/services
 * List services for carrier
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
    const isActive = url.searchParams.get('isActive');

    const services = await listCarrierServices(
      id,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );

    return NextResponse.json(services);
  } catch (error) {
    console.error('[CARRIER_SERVICES_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar serviços';
    return NextResponse.json({ message }, { status: 500 });
  }
}
