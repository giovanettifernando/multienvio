import { create } from "zustand";
import type { AdminPermissionKey, AdminStatus } from "@/lib/auth/types";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  status: AdminStatus;
  isSuperAdmin: boolean;
  permissions: AdminPermissionKey[];
  role?: string;
}

interface AdminSessionState {
  admin: AdminUser | null;
  setAdmin: (admin: AdminUser) => void;
  clearAdmin: () => void;
  isSuperAdmin: () => boolean;
  hasPermission: (permission: AdminPermissionKey) => boolean;
}

export const useAdminSession = create<AdminSessionState>((set, get) => ({
  admin: null,
  setAdmin: (admin) => set({ admin }),
  clearAdmin: () => set({ admin: null }),
  isSuperAdmin: () => {
    const { admin } = get();
    if (!admin) return false;
    return admin.isSuperAdmin === true;
  },
  hasPermission: (permission: AdminPermissionKey) => {
    const { admin } = get();
    if (!admin) return false;
    if (admin.isSuperAdmin) return true;
    return admin.permissions?.includes(permission) ?? false;
  },
}));
