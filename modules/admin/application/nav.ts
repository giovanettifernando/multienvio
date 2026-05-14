import type { AdminPermissionKey } from "@/modules/auth/application/types";

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
        permissions: ["INTEGRACOES"],
      },
      {
        key: "correios",
        label: "Correios",
        href: "/admin/correios",
        permissions: ["INTEGRACOES"],
      },
      {
        key: "jt",
        label: "J&T Express",
        href: "/admin/jt",
        permissions: ["INTEGRACOES"],
      },
      {
        key: "loggi",
        label: "Loggi",
        href: "/admin/loggi",
        permissions: ["INTEGRACOES"],
      },
      {
        key: 'total-express',
        label: 'Total Express',
        href: '/admin/total-express',
        permissions: ['INTEGRACOES'],
      },
      {
        key: "workers",
        label: "Workers",
        href: "/admin/workers",
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
        key: "openrouter",
        label: "OpenRouter (IA)",
        href: "/admin/config/openrouter",
        permissions: ["CONFIGURACOES"],
      },
      {
        key: "knowledge-base",
        label: "Base de Conhecimento",
        href: "/admin/config/knowledge-base",
        permissions: ["CONFIGURACOES"],
      },
      {
        key: "comissoes",
        label: "Comissões da plataforma",
        href: "/admin/config/comissoes",
        permissions: ["CONFIGURACOES"],
      },
      {
        key: "correios-agencies",
        label: "Agências dos Correios",
        href: "/admin/config/correios-agencies",
        permissions: ["CONFIGURACOES"],
      },
    ],
  },
];
