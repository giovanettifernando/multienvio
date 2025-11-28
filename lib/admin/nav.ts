import type { AdminPermissionKey } from "@/lib/auth/types";

export interface AdminNavItem {
  key: string;
  label: string;
  href?: string;
  /** Permissões necessárias (qualquer uma delas) */
  permissions?: AdminPermissionKey[];
  /** Subitens do menu (para criar submenus) */
  children?: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "dashboard", label: "Visão geral", href: "/admin" },
  {
    key: "financeiro",
    label: "Financeiro",
    children: [
      {
        key: "movimentacoes",
        label: "Movimentações",
        href: "/admin/financeiro/movimentacoes",
        permissions: ["FINANCEIRO"],
      },
      {
        key: "repasses",
        label: "Repasses",
        href: "/admin/financeiro/repasses",
        permissions: ["FINANCEIRO"],
      },
      {
        key: "comissoes-financeiro",
        label: "Comissões",
        href: "/admin/financeiro/comissoes",
        permissions: ["FINANCEIRO"],
      },
      {
        key: "despesas",
        label: "Despesas",
        href: "/admin/financeiro/despesas",
        permissions: ["FINANCEIRO"],
      },
      {
        key: "relatorios-fiscais",
        label: "Relatórios",
        href: "/admin/financeiro/relatorios",
        permissions: ["FINANCEIRO"],
      },
    ],
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
    children: [
      {
        key: "gateway-pagamento",
        label: "Gateway de Pagamento",
        href: "/admin/gateway-pagamento",
        permissions: ["FINANCEIRO"],
      },
      {
        key: "transportadoras",
        label: "Transportadoras",
        href: "/admin/integracoes",
        permissions: ["INTEGRACOES"],
      },
      {
        key: "correios",
        label: "Correios",
        href: "/admin/integracoes/correios",
        permissions: ["INTEGRACOES"],
      },
    ],
  },
  {
    key: "suporte",
    label: "Suporte",
    href: "/admin/suporte",
    permissions: ["SUPORTE"],
  },
  {
    key: "cadastros",
    label: "Cadastros",
    children: [
      {
        key: "contas",
        label: "Contas de clientes",
        href: "/admin/contas",
        permissions: ["CONTAS"],
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
    ],
  },
  {
    key: "config",
    label: "Configurações",
    children: [
      {
        key: "servidor-email",
        label: "Servidor de e-mail",
        href: "/admin/servidor-email",
        permissions: ["CONFIGURACOES"],
      },
      {
        key: "google-oauth",
        label: "Credenciais Google",
        href: "/admin/config/google-oauth",
        permissions: ["CONFIGURACOES"],
      },
      {
        key: "comissoes",
        label: "Comissões da plataforma",
        href: "/admin/config/comissoes",
        permissions: ["CONFIGURACOES"],
      },
    ],
  },
];
