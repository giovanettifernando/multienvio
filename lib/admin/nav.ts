import type { AdminRole } from "@/stores/useAdminSession";

export interface AdminNavItem {
  key: string;
  label: string;
  href: string;
  roles?: AdminRole[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "dashboard", label: "Visão geral", href: "/admin" },
  {
    key: "contas",
    label: "Contas de clientes",
    href: "/admin/contas",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    href: "/admin/financeiro",
    roles: ["superadmin", "finance"],
  },
  {
    key: "operacoes",
    label: "Operações",
    href: "/admin/operacoes",
    roles: ["superadmin", "ops"],
  },
  {
    key: "integracoes",
    label: "Integrações",
    href: "/admin/integracoes",
  },
  {
    key: "usuarios",
    label: "Usuários (admin)",
    href: "/admin/usuarios",
    roles: ["superadmin"],
  },
  {
    key: "config",
    label: "Configurações",
    href: "/admin/config",
    roles: ["superadmin"],
  },
];
