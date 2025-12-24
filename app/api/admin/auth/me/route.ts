import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, StaffStatus } from '@prisma/client';

type AdminMeResponse = {
  staff: {
    id: string;
    name: string;
    email: string;
    status: StaffStatus;
    role: string | undefined;
    isSuperAdmin: boolean;
    permissions: AdminPermission[];
    lastLoginAt: string | null;
    lastAccessAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export const GET = withApiHandler<AdminMeResponse>(async (context) => {
  const { req, logger } = context;

  // Get admin session from cookie - no permission check needed for /me endpoint
  const session = await requireAdminSession(req);

  // Find staff user in database
  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    include: {
      role: true,
    },
  });

  if (!staffUser) {
    throw new ApiError({
      code: 'not_found',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  // Check if staff is active
  if (staffUser.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'forbidden',
      message: 'Conta inativa ou bloqueada',
      status: 403,
    });
  }

  logger.info('admin_me_success', { staffId: staffUser.id });

  // Return staff data (without passwordHash)
  const staff = {
    id: staffUser.id,
    name: staffUser.name,
    email: staffUser.email,
    status: staffUser.status,
    role: staffUser.role?.name,
    isSuperAdmin: staffUser.isSuperAdmin,
    permissions: staffUser.isSuperAdmin
      ? Object.values(AdminPermission)
      : staffUser.permissions,
    lastLoginAt: staffUser.lastLoginAt?.toISOString() || null,
    lastAccessAt: staffUser.lastAccessAt?.toISOString() || null,
    createdAt: staffUser.createdAt.toISOString(),
    updatedAt: staffUser.updatedAt.toISOString(),
  };

  return { data: { staff } };
});
