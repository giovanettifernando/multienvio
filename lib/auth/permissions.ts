import type { AdminPermission, StaffUser } from "@prisma/client";

export function canAccess(user: Pick<StaffUser, "isSuperAdmin" | "permissions"> | null | undefined, perm: AdminPermission): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions?.includes(perm) ?? false;
}

export function hasAnyPermission(
  user: Pick<StaffUser, "isSuperAdmin" | "permissions"> | null | undefined,
  perms: AdminPermission[],
): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return perms.some((perm) => user.permissions?.includes(perm));
}
