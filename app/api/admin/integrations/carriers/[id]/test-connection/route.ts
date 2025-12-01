
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { testCarrierConnection } from '@/lib/integrations/carriers/carrier.service';
import { testCarrierConnectionSchema } from '@/lib/validation/integrations-carriers';
import { prisma } from '@/lib/db';

/**
 * POST /api/admin/integrations/carriers/[id]/test-connection
 * Test connection to carrier API
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

    // Parse body
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = testCarrierConnectionSchema.safeParse({
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

    const data = parsed.data;

    // Test connection
    const result = await testCarrierConnection(data.carrierId, data.environment);

    // Audit log
    await prisma.staffAuditLog.create({
      data: {
        actorId: session.staffId,
        action: 'test_carrier_connection',
        entity: 'Carrier',
        entityId: id,
        data: {
          environment: data.environment,
          success: result.success,
          latency: result.latency,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[CARRIER_TEST_CONNECTION]', error);
    const message = error instanceof Error ? error.message : 'Erro ao testar conexão';
    return NextResponse.json({ message }, { status: 500 });
  }
}
