/**
 * Mock database em memória para usuários administrativos
 */
import type { AdminUser } from "./types";

// eslint-disable-next-line prefer-const
let users: AdminUser[] = [
  {
    id: "master-001",
    name: "Administrador Master",
    email: "master@enviolegal.com",
    phone: "+55 11 98765-4321",
    status: "active",
    roles: ["admin.super"],
    lastLoginAt: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user-002",
    name: "João Silva",
    email: "joao.silva@enviolegal.com",
    phone: "+55 11 91234-5678",
    status: "active",
    roles: ["operations.read", "operations.manage", "shipments.read"],
    lastLoginAt: "2025-10-25T14:30:00.000Z",
    createdAt: "2024-02-15T10:00:00.000Z",
    updatedAt: "2025-10-20T09:15:00.000Z",
  },
  {
    id: "user-003",
    name: "Maria Santos",
    email: "maria.santos@enviolegal.com",
    phone: "+55 11 92345-6789",
    status: "active",
    roles: [
      "finance.read",
      "finance.manage",
      "finance.payouts",
      "billing.read",
      "billing.manage",
    ],
    lastLoginAt: "2025-10-26T08:00:00.000Z",
    createdAt: "2024-03-10T14:30:00.000Z",
    updatedAt: "2025-10-25T16:45:00.000Z",
  },
  {
    id: "user-004",
    name: "Pedro Costa",
    email: "pedro.costa@enviolegal.com",
    phone: null,
    status: "blocked",
    roles: ["integrations.read", "integrations.manage"],
    lastLoginAt: "2025-09-15T11:20:00.000Z",
    createdAt: "2024-04-20T09:00:00.000Z",
    updatedAt: "2025-10-01T10:30:00.000Z",
  },
  {
    id: "user-005",
    name: "Ana Oliveira",
    email: "ana.oliveira@enviolegal.com",
    phone: "+55 11 93456-7890",
    status: "active",
    roles: [
      "admin.users.read",
      "admin.users.manage",
      "pickup.read",
      "pickup.manage",
    ],
    lastLoginAt: "2025-10-26T07:45:00.000Z",
    createdAt: "2024-05-05T16:00:00.000Z",
    updatedAt: "2025-10-24T13:20:00.000Z",
  },
  {
    id: "user-006",
    name: "Carlos Mendes",
    email: "carlos.mendes@enviolegal.com",
    phone: "+55 11 94567-8901",
    status: "active",
    roles: ["shipments.read", "shipments.manage", "operations.read"],
    lastLoginAt: null,
    createdAt: "2025-10-01T10:00:00.000Z",
    updatedAt: "2025-10-01T10:00:00.000Z",
  },
];

let nextId = 7;

export const mockUsersDb = {
  getAll: (): AdminUser[] => [...users],

  findById: (id: string): AdminUser | undefined => {
    return users.find((u) => u.id === id);
  },

  findByEmail: (email: string): AdminUser | undefined => {
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  create: (data: Omit<AdminUser, "id" | "createdAt" | "updatedAt">): AdminUser => {
    const now = new Date().toISOString();
    const newUser: AdminUser = {
      ...data,
      id: `user-${String(nextId++).padStart(3, "0")}`,
      createdAt: now,
      updatedAt: now,
    };
    users.push(newUser);
    return newUser;
  },

  update: (id: string, data: Partial<AdminUser>): AdminUser | null => {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    const updated: AdminUser = {
      ...users[index],
      ...data,
      id: users[index].id, // prevent ID change
      createdAt: users[index].createdAt, // prevent createdAt change
      updatedAt: new Date().toISOString(),
    };

    users[index] = updated;
    return updated;
  },

  delete: (id: string): boolean => {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    users.splice(index, 1);
    return true;
  },

  updateStatus: (id: string, status: "active" | "blocked"): AdminUser | null => {
    return mockUsersDb.update(id, { status });
  },

  updateLastLogin: (id: string): AdminUser | null => {
    return mockUsersDb.update(id, { lastLoginAt: new Date().toISOString() });
  },
};
