import type { AdminPermission, StaffUser } from "@prisma/client";
import { NextResponse } from "next/server";
import type { AdminJWTPayload } from "./admin-session";

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

/**
 * Check if admin session has required permission
 * Returns 403 error response if permission is missing
 */
export function requirePermission(
  session: AdminJWTPayload | null,
  permission: AdminPermission
): NextResponse | null {
  if (!session) {
    return NextResponse.json(
      { message: 'Não autenticado' },
      { status: 401 }
    );
  }

  // Super admins have all permissions
  if (session.isSuperAdmin) {
    return null;
  }

  // Check if user has the required permission
  if (!session.permissions?.includes(permission)) {
    return NextResponse.json(
      { message: 'Sem permissão para acessar este recurso' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Check if admin session has any of the required permissions
 * Returns 403 error response if none of the permissions match
 */
export function requireAnyPermission(
  session: AdminJWTPayload | null,
  permissions: AdminPermission[]
): NextResponse | null {
  if (!session) {
    return NextResponse.json(
      { message: 'Não autenticado' },
      { status: 401 }
    );
  }

  // Super admins have all permissions
  if (session.isSuperAdmin) {
    return null;
  }

  // Check if user has any of the required permissions
  const hasPermission = permissions.some(perm =>
    session.permissions?.includes(perm)
  );

  if (!hasPermission) {
    return NextResponse.json(
      { message: 'Sem permissão para acessar este recurso' },
      { status: 403 }
    );
  }

  return null;
}
