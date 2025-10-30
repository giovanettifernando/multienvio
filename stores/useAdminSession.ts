import { create } from "zustand";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

interface AdminSessionState {
  admin: AdminUser | null;
  setAdmin: (admin: AdminUser) => void;
  clearAdmin: () => void;
  isAdmin: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAdminSession = create<AdminSessionState>((set, get) => ({
  admin: null,
  setAdmin: (admin) => set({ admin }),
  clearAdmin: () => set({ admin: null }),
  isAdmin: () => {
    const { admin } = get();
    if (!admin) return false;
    return admin.role === 'admin';
  },
  hasRole: (role: string) => {
    const { admin } = get();
    if (!admin) return false;
    return admin.role === role || admin.role === 'admin';
  },
}));
