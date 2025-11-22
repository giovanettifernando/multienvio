export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';
import {
  getCarrierService,
  updateCarrierService,
  deleteCarrierService,
} from '@/lib/integrations/carriers/carrier-service.service';
import {
  updateCarrierServiceSchema,
  type UpdateCarrierServiceInput,
} from '@/lib/validation/integrations-carriers';

/**
 * GET /api/admin/integrations/carriers/[id]/services/[serviceId]
 * Get specific service
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
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

    const { id, serviceId } = await params;

    const service = await getCarrierService(serviceId);

    if (!service) {
      return NextResponse.json({ message: 'Serviço não encontrado' }, { status: 404 });
    }

    // Verify it belongs to the carrier
    if (service.carrierId !== id) {
      return NextResponse.json({ message: 'Serviço não pertence a esta transportadora' }, { status: 400 });
    }

    return NextResponse.json(service);
  } catch (error) {
    console.error('[CARRIER_SERVICE_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar serviço';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/integrations/carriers/[id]/services/[serviceId]
 * Update service
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
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

    const { id, serviceId } = await params;

    // Verify service exists and belongs to carrier
    const existing = await prisma.carrierService.findUnique({
      where: { id: serviceId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Serviço não encontrado' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Serviço não pertence a esta transportadora' }, { status: 400 });
    }

    // Parse body
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = updateCarrierServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: UpdateCarrierServiceInput = parsed.data;
    const service = await updateCarrierService(serviceId, data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'update_carrier_service',
        entity: 'CarrierService',
        entityId: serviceId,
        data: {
          carrierId: id,
          updatedFields: Object.keys(data),
        },
      },
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error('[CARRIER_SERVICE_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar serviço';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/integrations/carriers/[id]/services/[serviceId]
 * Delete service
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
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

    const { id, serviceId } = await params;

    // Verify service exists and belongs to carrier
    const existing = await prisma.carrierService.findUnique({
      where: { id: serviceId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Serviço não encontrado' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Serviço não pertence a esta transportadora' }, { status: 400 });
    }

    await deleteCarrierService(serviceId);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'delete_carrier_service',
        entity: 'CarrierService',
        entityId: serviceId,
        data: {
          carrierId: id,
          serviceId: existing.serviceId,
          name: existing.name,
        },
      },
    });

    return NextResponse.json({ message: 'Serviço deletado com sucesso' });
  } catch (error) {
    console.error('[CARRIER_SERVICE_DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao deletar serviço';
    return NextResponse.json({ message }, { status: 500 });
  }
}
