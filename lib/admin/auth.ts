import type { AdminUser } from "@/stores/useAdminSession";

export const ADMIN_COOKIE = "admin_auth";
export const ADMIN_SESSION_STORAGE_KEY = "envio-legal-admin-session";

export function getAdminTokenFromCookie() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${ADMIN_COOKIE}=([^;]*)`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function setAdminTokenCookie(token: string) {
  // Segurança real deve ser tratada no back-end; mock simplificado para DEV.
  document.cookie = `${ADMIN_COOKIE}=${encodeURIComponent(
    token,
  )}; path=/; samesite=lax`;
}

export function clearAdminTokenCookie() {
  document.cookie = `${ADMIN_COOKIE}=; path=/; Max-Age=0`;
}

export function devAdminBypassActive() {
  return process.env.NEXT_PUBLIC_DEV_ADMIN_BYPASS === "true";
}

export function saveAdminSessionToStorage(admin: AdminUser, token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    ADMIN_SESSION_STORAGE_KEY,
    JSON.stringify({ admin, token }),
  );
}

export function loadAdminSessionFromStorage():
  | { admin: AdminUser; token: string }
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { admin: AdminUser; token: string }) : null;
  } catch {
    return null;
  }
}

export function clearAdminSessionStorage() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}
