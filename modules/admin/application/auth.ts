'use client';

import type { AdminUser } from '@/modules/admin/ui/state/useAdminSession';
import { ADMIN_PERMISSION_KEYS, type AdminPermissionKey } from "@/modules/auth/application/types";

export const ADMIN_COOKIE = "admin_auth";
export const ADMIN_SESSION_STORAGE_KEY = "envio-legal-admin-session";

/**
 * Get admin token from HttpOnly cookie (read-only, managed by server)
 * Note: HttpOnly cookies cannot be read by JavaScript for security.
 * This function is kept for compatibility but will return null in production.
 */
export function getAdminTokenFromCookie() {
  if (typeof document === "undefined") return null;
  // HttpOnly cookies are not accessible via document.cookie
  // This is intentional for security reasons
  return null;
}

/**
 * Check if admin is authenticated by attempting to call /api/admin/auth/me
 * This is the proper way to check authentication with HttpOnly cookies
 */
export async function checkAdminAuth(): Promise<AdminUser | null> {
  try {
    const response = await fetch("/api/admin/auth/me", {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const json = await response.json();
    // API returns { data: { staff } } format from withApiHandler
    const staff = json?.data?.staff ?? json?.staff;
    if (!staff) return null;

    const permissionSet = new Set<AdminPermissionKey>(ADMIN_PERMISSION_KEYS);
    const rawPermissions = Array.isArray(staff.permissions) ? staff.permissions : [];
    const normalizedPermissions: AdminPermissionKey[] = staff.isSuperAdmin
      ? [...ADMIN_PERMISSION_KEYS]
      : rawPermissions.filter(
          (perm: unknown): perm is AdminPermissionKey =>
            typeof perm === "string" && permissionSet.has(perm as AdminPermissionKey),
        );

    const normalizedStatus = staff.status === "BLOCKED" ? "blocked" : "active";

    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      status: normalizedStatus,
      isSuperAdmin: Boolean(staff.isSuperAdmin),
      permissions: normalizedPermissions,
      role: staff.role,
    };
  } catch {
    return null;
  }
}

/**
 * Logout admin by calling the logout API
 */
export async function logoutAdmin(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/auth/logout", {
      method: "POST",
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}
