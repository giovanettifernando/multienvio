import type { AdminUser } from "@/stores/useAdminSession";

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
    const response = await fetch("/api/admin/auth/me");
    if (!response.ok) return null;
    const data = await response.json();
    return data.staff || null;
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
    });
    return response.ok;
  } catch {
    return false;
  }
}
