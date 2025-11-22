export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { rotateCarrierCredential } from '@/lib/integrations/carriers/carrier-credential.service';
import {
  createCarrierCredentialSchema,
  type CreateCarrierCredentialInput,
} from '@/lib/validation/integrations-carriers';

/**
 * POST /api/admin/integrations/carriers/[id]/credentials/[credId]/rotate
 * Rotate credential (creates new one, marks old as inactive)
 */
export async function POST(
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

    // Parse body with new credential data
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = createCarrierCredentialSchema.safeParse({
      ...body,
      carrierId: id,
      environment: existing.environment, // Keep same environment
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

    const data: CreateCarrierCredentialInput = parsed.data;
    const newCredential = await rotateCarrierCredential(credId, data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'rotate_carrier_credential',
        entity: 'CarrierCredential',
        entityId: credId,
        data: {
          carrierId: id,
          environment: existing.environment,
          oldCredentialId: credId,
          newCredentialId: newCredential.id,
        },
      },
    });

    return NextResponse.json({
      message: 'Credencial rotacionada com sucesso',
      credential: newCredential,
    });
  } catch (error) {
    console.error('[CARRIER_CREDENTIAL_ROTATE]', error);
    const message = error instanceof Error ? error.message : 'Erro ao rotacionar credencial';
    return NextResponse.json({ message }, { status: 500 });
  }
}
