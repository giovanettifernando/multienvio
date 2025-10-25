import { create } from "zustand";

export type AdminRole = "superadmin" | "ops" | "finance";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
}

interface AdminSessionState {
  admin: AdminUser | null;
  token: string | null;
  setAdmin: (admin: AdminUser, token: string) => void;
  clearAdmin: () => void;
}

export const useAdminSession = create<AdminSessionState>((set) => ({
  admin: null,
  token: null,
  setAdmin: (admin, token) => set({ admin, token }),
  clearAdmin: () => set({ admin: null, token: null }),
}));
