export interface AdminNavItem {
  key: string;
  label: string;
  href: string;
  /** Permissões necessárias (qualquer uma delas) */
  permissions?: string[];
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
    permissions: ["finance.read", "finance.manage"],
  },
  {
    key: "operacoes",
    label: "Operações",
    href: "/admin/operacoes",
    permissions: ["operations.read", "operations.manage"],
  },
  {
    key: "integracoes",
    label: "Integrações",
    href: "/admin/integracoes",
    permissions: ["integrations.read", "integrations.manage"],
  },
  {
    key: "suporte",
    label: "Suporte",
    href: "/admin/suporte",
  },
  {
    key: "coletores",
    label: "Coletores",
    href: "/admin/coletores",
  },
  {
    key: "pontos-de-coleta",
    label: "Pontos de Coleta",
    href: "/admin/pontos-de-coleta",
    permissions: ["pickup.read", "pickup.manage"],
  },
  {
    key: "usuarios",
    label: "Usuários",
    href: "/admin/usuarios",
    permissions: ["admin.users.read", "admin.users.manage"],
  },
  {
    key: "config",
    label: "Configurações",
    href: "/admin/config",
  },
];
