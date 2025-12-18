/**
 * Query keys para React Query - Admin Users
 */

export const adminUsersKeys = {
  all: ["admin.users"] as const,
  lists: () => [...adminUsersKeys.all, "list"] as const,
  list: (params?: string) => [...adminUsersKeys.lists(), params ?? "all"] as const,
  details: () => [...adminUsersKeys.all, "detail"] as const,
  detail: (id: string) => [...adminUsersKeys.details(), id] as const,
  roles: ["admin.roles"] as const,
};
