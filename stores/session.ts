/**
 * @deprecated Este arquivo foi mesclado com stores/auth.ts
 * Use useAuthStore em vez de useSessionStore
 *
 * Migração:
 * - useSessionStore -> useAuthStore
 * - usuario -> user
 * - setUsuario -> setUser/login
 * - clearSession -> logout
 * - hasAccess -> isAuthenticated()
 */

export { useAuthStore as useSessionStore, type AuthUser as Usuario } from './auth';
