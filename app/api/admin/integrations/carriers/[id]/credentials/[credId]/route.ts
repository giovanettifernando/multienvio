export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  updateCarrierCredential,
  deleteCarrierCredential,
  getCarrierCredential,
} from '@/lib/integrations/carriers/carrier-credential.service';
import {
  updateCarrierCredentialSchema,
  type UpdateCarrierCredentialInput,
} from '@/lib/validation/integrations-carriers';

/**
 * GET /api/admin/integrations/carriers/[id]/credentials/[credId]
 * Get specific credential (masked)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; credId: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
     
    const { session } = authResult;

    const { id, credId } = await params;

    const credential = await getCarrierCredential(credId);

    if (!credential) {
      return NextResponse.json({ message: 'Credencial não encontrada' }, { status: 404 });
    }

    // Verify it belongs to the carrier
    if (credential.carrierId !== id) {
      return NextResponse.json({ message: 'Credencial não pertence a esta transportadora' }, { status: 400 });
    }

    return NextResponse.json(credential);
  } catch (error) {
    console.error('[CARRIER_CREDENTIAL_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar credencial';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/integrations/carriers/[id]/credentials/[credId]
 * Update credential
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; credId: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { id, credId } = await params;

    // Verify credential exists and belongs to carrier
    const existing = await prisma.carrierCredential.findUnique({
      where: { id: credId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Credencial não encontrada' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Credencial não pertence a esta transportadora' }, { status: 400 });
    }

    // Parse body
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = updateCarrierCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: UpdateCarrierCredentialInput = parsed.data;
    const credential = await updateCarrierCredential(credId, data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'update_carrier_credential',
        entity: 'CarrierCredential',
        entityId: credId,
        data: {
          carrierId: id,
          updatedFields: Object.keys(data),
        },
      },
    });

    return NextResponse.json(credential);
  } catch (error) {
    console.error('[CARRIER_CREDENTIAL_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar credencial';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/integrations/carriers/[id]/credentials/[credId]
 * Delete credential
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; credId: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { id, credId } = await params;

    // Verify credential exists and belongs to carrier
    const existing = await prisma.carrierCredential.findUnique({
      where: { id: credId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Credencial não encontrada' }, { status: 404 });
    }

    if (existing.carrierId !== id) {
      return NextResponse.json({ message: 'Credencial não pertence a esta transportadora' }, { status: 400 });
    }

    await deleteCarrierCredential(credId);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'delete_carrier_credential',
        entity: 'CarrierCredential',
        entityId: credId,
        data: {
          carrierId: id,
          environment: existing.environment,
          authType: existing.authType,
        },
      },
    });

    return NextResponse.json({ message: 'Credencial deletada com sucesso' });
  } catch (error) {
    console.error('[CARRIER_CREDENTIAL_DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao deletar credencial';
    return NextResponse.json({ message }, { status: 500 });
  }
}
