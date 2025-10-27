import { create } from "zustand";
import { hasSuperAdmin } from "@/lib/auth/roles";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface AdminSessionState {
  admin: AdminUser | null;
  token: string | null;
  setAdmin: (admin: AdminUser, token: string) => void;
  clearAdmin: () => void;
  isSuperAdmin: () => boolean;
  hasPermission: (role: string) => boolean;
}

export const useAdminSession = create<AdminSessionState>((set, get) => ({
  admin: null,
  token: null,
  setAdmin: (admin, token) => set({ admin, token }),
  clearAdmin: () => set({ admin: null, token: null }),
  isSuperAdmin: () => {
    const { admin } = get();
    if (!admin) return false;
    return hasSuperAdmin(admin.roles);
  },
  hasPermission: (role: string) => {
    const { admin, isSuperAdmin } = get();
    if (!admin) return false;
    if (isSuperAdmin()) return true;
    return admin.roles.includes(role);
  },
}));
