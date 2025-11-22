export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  createCarrierCredential,
  listCarrierCredentials,
} from '@/lib/integrations/carriers/carrier-credential.service';
import {
  createCarrierCredentialSchema,
  type CreateCarrierCredentialInput,
} from '@/lib/validation/integrations-carriers';

/**
 * POST /api/admin/integrations/carriers/[id]/credentials
 * Create new credential for carrier
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
    const parsed = createCarrierCredentialSchema.safeParse({
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

    const data: CreateCarrierCredentialInput = parsed.data;
    const credential = await createCarrierCredential(data);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'create_carrier_credential',
        entity: 'CarrierCredential',
        entityId: credential.id,
        data: {
          carrierId: id,
          environment: credential.environment,
          authType: credential.authType,
        },
      },
    });

    return NextResponse.json(credential, { status: 201 });
  } catch (error) {
    console.error('[CARRIER_CREDENTIALS_POST]', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar credencial';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/admin/integrations/carriers/[id]/credentials
 * List credentials for carrier
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
    const environment = url.searchParams.get('environment');
    const isActive = url.searchParams.get('isActive');

    const credentials = await listCarrierCredentials(
      id,
      environment as 'SANDBOX' | 'PRODUCTION' | undefined,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );

    return NextResponse.json(credentials);
  } catch (error) {
    console.error('[CARRIER_CREDENTIALS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar credenciais';
    return NextResponse.json({ message }, { status: 500 });
  }
}
