import type { AdminPermissionKey } from "@/lib/auth/types";

export interface AdminNavItem {
  key: string;
  label: string;
  href: string;
  /** Permissões necessárias (qualquer uma delas) */
  permissions?: AdminPermissionKey[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "dashboard", label: "Visão geral", href: "/admin" },
  {
    key: "contas",
    label: "Contas de clientes",
    href: "/admin/contas",
    permissions: ["CONTAS"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    href: "/admin/financeiro",
    permissions: ["FINANCEIRO"],
  },
  {
    key: "gateway-pagamento",
    label: "Gateway de Pagamento",
    href: "/admin/gateway-pagamento",
    permissions: ["FINANCEIRO"],
  },
  {
    key: "operacoes",
    label: "Operações",
    href: "/admin/operacoes",
    permissions: ["OPERACOES"],
  },
  {
    key: "integracoes",
    label: "Integrações",
    href: "/admin/integracoes",
    permissions: ["INTEGRACOES"],
  },
  {
    key: "suporte",
    label: "Suporte",
    href: "/admin/suporte",
    permissions: ["SUPORTE"],
  },
  {
    key: "coletores",
    label: "Coletores",
    href: "/admin/coletores",
    permissions: ["COLETORES"],
  },
  {
    key: "pontos-de-coleta",
    label: "Pontos de Coleta",
    href: "/admin/pontos-de-coleta",
    permissions: ["PONTOS_COLETA"],
  },
  {
    key: "usuarios",
    label: "Usuários",
    href: "/admin/usuarios",
    permissions: ["USUARIOS"],
  },
  {
    key: "config",
    label: "Configurações",
    href: "/admin/config",
    permissions: ["CONFIGURACOES"],
  },
];
