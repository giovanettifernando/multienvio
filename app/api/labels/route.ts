/**
 * Labels API Route
 *
 * GET /api/labels - Lista etiquetas do usuário
 * PATCH /api/labels?id=xxx - Marca etiqueta como impressa
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { listUserLabels, markLabelAsPrinted } from '@/modules/labels/application';
import type { LabelsResponse, PrintStatus } from '@/shared/types/label';

/**
 * GET /api/labels
 */
export const GET = withApiHandler<LabelsResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10);
  const q = searchParams.get('q') ?? '';
  const printStatus = (searchParams.get('printStatus') ?? 'all') as PrintStatus | 'all';

  const result = await listUserLabels(
    session.userId,
    { q, printStatus },
    { page, pageSize }
  );

  return { data: result };
});

interface LabelPrintUpdateResponse {
  message: string;
  label: {
    id: string;
    isPrinted: boolean;
    printedAt?: string;
  };
}

/**
 * PATCH /api/labels?id=xxx
 */
export const PATCH = withApiHandler<LabelPrintUpdateResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const labelId = searchParams.get('id');

  if (!labelId) {
    throw new ApiError({ code: 'validation_error', message: 'ID da etiqueta é obrigatório', status: 400 });
  }

  const label = await markLabelAsPrinted(session.userId, labelId);

  return {
    data: {
      message: 'Etiqueta marcada como impressa',
      label,
    },
  };
});
