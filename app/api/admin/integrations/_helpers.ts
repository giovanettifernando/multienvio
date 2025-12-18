import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';

/**
 * Helper function for checking admin permissions
 * Safely handles undefined permissions array
 */
export function checkAdminPermission(
  session: { permissions?: string[]; isSuperAdmin?: boolean },
  permission: string
): boolean {
  const permissions = session.permissions || [];
  return permissions.includes(permission) || !!session.isSuperAdmin;
}

/**
 * Helper function for audit logging
 */
export async function logAuditAction(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  data: unknown
): Promise<void> {
  await prisma.staffAuditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      data: data as Prisma.InputJsonValue,
    },
  });
}
