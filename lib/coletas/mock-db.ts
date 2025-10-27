/**
 * Mock database em memória para coletas
 */
import type { Coleta, ColetaStatus } from "./types";

const coletas: Coleta[] = [
  {
    id: "coleta-001",
    trackingCode: "BR123456789BR",
    origemCep: "01310-100",
    destinoCep: "04567-890",
    scheduledFor: "2025-10-28",
    status: "agendada",
    createdAt: "2025-10-26T10:00:00.000Z",
    updatedAt: "2025-10-26T10:00:00.000Z",
  },
  {
    id: "coleta-002",
    trackingCode: "BR987654321BR",
    origemCep: "04567-890",
    destinoCep: "20040-020",
    scheduledFor: "2025-10-27",
    status: "agendada",
    createdAt: "2025-10-25T14:30:00.000Z",
    updatedAt: "2025-10-25T14:30:00.000Z",
  },
  {
    id: "coleta-003",
    trackingCode: "JAD1234567BR",
    origemCep: "20040-020",
    destinoCep: "30130-100",
    scheduledFor: "2025-10-29",
    status: "reagendada",
    createdAt: "2025-10-24T09:15:00.000Z",
    updatedAt: "2025-10-26T11:20:00.000Z",
  },
  {
    id: "coleta-004",
    trackingCode: "BR555666777BR",
    origemCep: "30130-100",
    destinoCep: "01310-100",
    scheduledFor: "2025-10-23",
    status: "concluida",
    createdAt: "2025-10-20T16:45:00.000Z",
    updatedAt: "2025-10-23T10:30:00.000Z",
  },
  {
    id: "coleta-005",
    trackingCode: "BR111222333BR",
    origemCep: "01310-100",
    destinoCep: "80010-000",
    scheduledFor: "2025-10-30",
    status: "agendada",
    createdAt: "2025-10-26T08:00:00.000Z",
    updatedAt: "2025-10-26T08:00:00.000Z",
  },
];

let nextId = 6;

export const mockColetasDb = {
  getAll: (): Coleta[] => [...coletas],

  findById: (id: string): Coleta | undefined => {
    return coletas.find((c) => c.id === id);
  },

  create: (
    data: Omit<Coleta, "id" | "status" | "createdAt" | "updatedAt">
  ): Coleta => {
    const now = new Date().toISOString();
    const newColeta: Coleta = {
      ...data,
      id: `coleta-${String(nextId++).padStart(3, "0")}`,
      status: "agendada",
      createdAt: now,
      updatedAt: now,
    };
    coletas.push(newColeta);
    return newColeta;
  },

  update: (id: string, scheduledFor: string): Coleta | null => {
    const index = coletas.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const updated: Coleta = {
      ...coletas[index],
      scheduledFor,
      status: "reagendada" as ColetaStatus,
      updatedAt: new Date().toISOString(),
    };

    coletas[index] = updated;
    return updated;
  },

  delete: (id: string): boolean => {
    const index = coletas.findIndex((c) => c.id === id);
    if (index === -1) return false;
    coletas.splice(index, 1);
    return true;
  },
};
