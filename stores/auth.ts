import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/auth/types";
import { AuthRole, UserStatus } from "@/types/contracts";

/**
 * @deprecated Use User from global contracts
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  token?: string;
};

type AuthState = {
  user: User | null;
  hasCompany: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    aceiteTermos?: boolean;
    acceptTerms?: boolean;
  }) => Promise<{
    success: boolean;
    error?: string;
    userId?: string;
    email?: string;
    emailVerificationSent?: boolean;
    emailError?: string;
  }>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<User | null>;
  updateUser: (partial: Partial<User>) => void;
  setHasCompany: (value: boolean) => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  hasRole: (role: AuthRole) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasCompany: false,
      setUser: (user) => set({ user }),

      // Login with real API
      login: async (email: string, password: string) => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include', // Important for cookies
          });

          const data = await response.json();

          if (!response.ok) {
            return { success: false, error: data.message || 'Erro ao fazer login' };
          }

          set({ user: data.user });
          return { success: true, user: data.user };
        } catch (error) {
          console.error('Login error:', error);
          return { success: false, error: 'Erro ao conectar com o servidor' };
        }
      },

      // Register with real API
      register: async (data) => {
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include', // Important for cookies
          });

          const result = await response.json();

          if (!response.ok) {
            return { success: false, error: result.message || 'Erro ao criar conta' };
          }

          // DON'T auto-login after registration - user must verify email first
          // Return result with email verification status
          return {
            success: true,
            userId: result.userId,
            email: result.email,
            emailVerificationSent: result.emailVerificationSent,
            emailError: result.emailError,
          };
        } catch (error) {
          console.error('Register error:', error);
          return { success: false, error: 'Erro ao conectar com o servidor' };
        }
      },

      // Logout with real API
      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Always clear local state even if API call fails
          set({ user: null, hasCompany: false });
        }
      },

      // Fetch current user from /api/auth/me
      fetchCurrentUser: async () => {
        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include',
          });

          if (!response.ok) {
            set({ user: null });
            return null;
          }

          const data = await response.json();
          set({ user: data.user });
          return data.user;
        } catch (error) {
          console.error('Fetch current user error:', error);
          set({ user: null });
          return null;
        }
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? {
            ...state.user,
            ...partial,
            updatedAt: new Date().toISOString(),
          } : state.user,
        })),

      setHasCompany: (value) => set({ hasCompany: value }),

      isAuthenticated: () => {
        const user = get().user;
        return Boolean(user && user.status === UserStatus.ACTIVE);
      },

      isAdmin: () => {
        const user = get().user;
        return Boolean(user && user.roles.includes(AuthRole.ADMIN));
      },

      hasRole: (role: AuthRole) => {
        const user = get().user;
        return Boolean(user && user.roles.includes(role));
      },
    }),
    {
      name: "envio-legal-auth",
      version: 3, // Bump version for migration
    }
  )
);

// Seletor seguro para usar em componentes
export const useSessionUser = () => useAuthStore(s => s.user);

/**
 * Mock login para desenvolvimento
 * @deprecated Use o método login() real da store
 */
export function mockLogin(role?: AuthRole): User {
  const now = new Date().toISOString();

  const mockUser: User = {
    id: crypto.randomUUID(),
    name: role === AuthRole.ADMIN ? "Admin Sistema" : "João Silva",
    email: role === AuthRole.ADMIN ? "admin@enviolegal.com" : "joao@example.com",
    phone: "+5511999999999",
    status: UserStatus.ACTIVE,
    roles: role ? [role] : [], // Regular users have no admin roles
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };

  useAuthStore.getState().setUser(mockUser);
  return mockUser;
}

/**
 * Mock logout para desenvolvimento
 */
export function mockLogout() {
  useAuthStore.getState().logout();
}
