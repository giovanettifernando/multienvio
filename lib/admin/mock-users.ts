export interface AdminMockUser {
  id: string;
  name: string;
  email?: string;
}

export const adminMockUsers: AdminMockUser[] = [
  {
    id: "admin-001",
    name: "Ana Souza",
    email: "ana.souza@enviolegal.com.br",
  },
  {
    id: "admin-002",
    name: "Bruno Carvalho",
    email: "bruno.carvalho@enviolegal.com.br",
  },
  {
    id: "admin-003",
    name: "Carla Mendes",
    email: "carla.mendes@enviolegal.com.br",
  },
  {
    id: "admin-004",
    name: "Diego Ramos",
    email: "diego.ramos@enviolegal.com.br",
  },
];

export function getAdminMockUser(id: string) {
  return adminMockUsers.find((user) => user.id === id);
}
