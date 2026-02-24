import type { AdminPermissionKey } from "@/modules/auth/application/types";

export interface Role {
  key: string;
  label: string;
  description?: string;
}

export interface RoleGroup {
  key: string;
  label: string;
  roles: Role[];
}

export const ROLE_GROUPS: RoleGroup[] = [
  {
    key: "administrativo",
    label: "Administrativo",
    roles: [
      {
        key: "admin.super",
        label: "Super Administrador",
        description:
          "Acesso total a todas as funcionalidades do sistema, independente das permissões marcadas.",
      },
      {
        key: "CONTAS",
        label: "Contas de clientes",
        description: "Permite acessar e gerenciar informações de contas de clientes.",
      },
      {
        key: "USUARIOS",
        label: "Usuários administrativos",
        description: "Permite criar, editar e gerenciar usuários do painel administrativo.",
      },
      {
        key: "CONFIGURACOES",
        label: "Configurações",
        description: "Acesso às configurações do painel administrativo.",
      },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    roles: [
      {
        key: "FINANCEIRO",
        label: "Financeiro",
        description: "Permite visualizar e gerenciar informações financeiras.",
      },
    ],
  },
  {
    key: "operacoes",
    label: "Operações e Suporte",
    roles: [
      {
        key: "OPERACOES",
        label: "Operações",
        description: "Permite acompanhar operações e atividades operacionais.",
      },
      {
        key: "SUPORTE",
        label: "Suporte",
        description: "Permite acessar e gerenciar chamados de suporte.",
      },
    ],
  },
  {
    key: "integracoes",
    label: "Integrações",
    roles: [
      {
        key: "INTEGRACOES",
        label: "Integrações",
        description: "Permite visualizar e configurar integrações do sistema.",
      },
    ],
  },
  {
    key: "coletas",
    label: "Coletas",
    roles: [
      {
        key: "COLETORES",
        label: "Coletores",
        description: "Permite gerenciar coletores e suas informações.",
      },
      {
        key: "PONTOS_COLETA",
        label: "Pontos de Coleta",
        description: "Permite gerenciar pontos de coleta cadastrados.",
      },
    ],
  },
];

export function getAllRoles(): Role[] {
  return ROLE_GROUPS.flatMap((group) => group.roles);
}

export function getAllRoleKeys(): string[] {
  return getAllRoles().map((role) => role.key);
}

export function isSuperAdminRole(role: string): boolean {
  return role === "admin.super";
}

export function getSuperAdminRoles(): string[] {
  return getAllRoleKeys();
}

export function hasSuperAdmin(roles: string[]): boolean {
  return roles.some(isSuperAdminRole);
}

export function normalizeRoles(roles: string[]): string[] {
  if (hasSuperAdmin(roles)) {
    const allKeys = getAllRoleKeys();
    return Array.from(new Set(["admin.super", ...allKeys.filter((key) => key !== "admin.super")]));
  }
  return roles;
}

export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = getAllRoles()
  .filter((role) => !isSuperAdminRole(role.key))
  .reduce<Record<AdminPermissionKey, string>>((acc, role) => {
    acc[role.key as AdminPermissionKey] = role.label;
    return acc;
  }, {} as Record<AdminPermissionKey, string>);

export function roleKeyToPermission(roleKey: string): AdminPermissionKey | null {
  if (isSuperAdminRole(roleKey)) return null;
  const normalized = roleKey as AdminPermissionKey;
  return Object.prototype.hasOwnProperty.call(ADMIN_PERMISSION_LABELS, normalized)
    ? normalized
    : null;
}

export function permissionToRoleKey(permission: AdminPermissionKey): string {
  return permission;
}

export function getPermissionLabel(permission: AdminPermissionKey): string {
  return ADMIN_PERMISSION_LABELS[permission] ?? permission;
}
