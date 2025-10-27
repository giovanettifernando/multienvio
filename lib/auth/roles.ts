/**
 * Catálogo central de roles/permissões da plataforma
 */

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
    key: "admin",
    label: "Administração",
    roles: [
      {
        key: "admin.super",
        label: "Super Administrador",
        description: "Acesso total a todas as funcionalidades do sistema",
      },
      {
        key: "admin.users.read",
        label: "Visualizar Usuários",
        description: "Permite visualizar lista e detalhes de usuários",
      },
      {
        key: "admin.users.manage",
        label: "Gerenciar Usuários",
        description: "Permite criar, editar e excluir usuários",
      },
    ],
  },
  {
    key: "integrations",
    label: "Integrações",
    roles: [
      {
        key: "integrations.read",
        label: "Visualizar Integrações",
        description: "Permite visualizar integrações e configurações",
      },
      {
        key: "integrations.manage",
        label: "Gerenciar Integrações",
        description: "Permite configurar e modificar integrações",
      },
    ],
  },
  {
    key: "pickup",
    label: "Pontos de Coleta",
    roles: [
      {
        key: "pickup.read",
        label: "Visualizar Pontos de Coleta",
        description: "Permite visualizar pontos de coleta",
      },
      {
        key: "pickup.manage",
        label: "Gerenciar Pontos de Coleta",
        description: "Permite criar, editar e excluir pontos de coleta",
      },
    ],
  },
  {
    key: "operations",
    label: "Operações",
    roles: [
      {
        key: "operations.read",
        label: "Visualizar Operações",
        description: "Permite visualizar dados operacionais",
      },
      {
        key: "operations.manage",
        label: "Gerenciar Operações",
        description: "Permite modificar dados operacionais",
      },
    ],
  },
  {
    key: "finance",
    label: "Financeiro",
    roles: [
      {
        key: "finance.read",
        label: "Visualizar Financeiro",
        description: "Permite visualizar dados financeiros",
      },
      {
        key: "finance.manage",
        label: "Gerenciar Financeiro",
        description: "Permite modificar dados financeiros",
      },
      {
        key: "finance.payouts",
        label: "Executar Pagamentos",
        description: "Permite executar pagamentos e transferências",
      },
    ],
  },
  {
    key: "shipments",
    label: "Envios",
    roles: [
      {
        key: "shipments.read",
        label: "Visualizar Envios",
        description: "Permite visualizar envios",
      },
      {
        key: "shipments.manage",
        label: "Gerenciar Envios",
        description: "Permite modificar e cancelar envios",
      },
    ],
  },
  {
    key: "billing",
    label: "Faturamento",
    roles: [
      {
        key: "billing.read",
        label: "Visualizar Faturamento",
        description: "Permite visualizar dados de faturamento",
      },
      {
        key: "billing.manage",
        label: "Gerenciar Faturamento",
        description: "Permite modificar dados de faturamento",
      },
    ],
  },
];

/**
 * Retorna todas as roles disponíveis (flat list)
 */
export function getAllRoles(): Role[] {
  return ROLE_GROUPS.flatMap((group) => group.roles);
}

/**
 * Retorna todas as keys de roles
 */
export function getAllRoleKeys(): string[] {
  return getAllRoles().map((role) => role.key);
}

/**
 * Verifica se uma role concede acesso total
 */
export function isSuperAdminRole(role: string): boolean {
  return role === "admin.super";
}

/**
 * Retorna todas as roles quando usuário é super admin
 */
export function getSuperAdminRoles(): string[] {
  return getAllRoleKeys();
}

/**
 * Verifica se um conjunto de roles inclui super admin
 */
export function hasSuperAdmin(roles: string[]): boolean {
  return roles.some(isSuperAdminRole);
}

/**
 * Normaliza roles: se tem admin.super, retorna todas as roles
 */
export function normalizeRoles(roles: string[]): string[] {
  if (hasSuperAdmin(roles)) {
    return getSuperAdminRoles();
  }
  return roles;
}
