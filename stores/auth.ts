import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  token?: string;
};

type AuthState = {
  user: AuthUser | null;
  hasCompany: boolean;
  setUser: (user: AuthUser | null) => void;
  login: (user: AuthUser) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  logout: () => void;
  setHasCompany: (value: boolean) => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasCompany: false,
      setUser: (user) => set({ user }),
      login: (user) => set({ user }),
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : state.user,
        })),
      logout: () => set({ user: null, hasCompany: false }),
      setHasCompany: (value) => set({ hasCompany: value }),
      isAuthenticated: () => Boolean(get().user?.token),
    }),
    {
      name: "envio-legal-auth",
    }
  )
);
