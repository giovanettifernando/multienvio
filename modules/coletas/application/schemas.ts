/**
 * Schemas de validação para coletas
 */
import { z } from "zod";

const cepRegex = /^\d{5}-?\d{3}$/;

const isToday = (dateString: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date >= today;
};

export const coletaCreateSchema = z.object({
  trackingCode: z
    .string()
    .min(1, "Código de rastreio é obrigatório"),
  origemCep: z
    .string()
    .regex(cepRegex, "CEP de origem inválido"),
  destinoCep: z
    .string()
    .regex(cepRegex, "CEP de destino inválido"),
  scheduledFor: z
    .string()
    .refine((date) => {
      // Validate ISO date format
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }, "Data inválida")
    .refine(
      (date) => isToday(date),
      "Data da coleta deve ser hoje ou no futuro"
    ),
});

export const coletaUpdateSchema = z.object({
  scheduledFor: z
    .string()
    .refine((date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }, "Data inválida")
    .refine(
      (date) => isToday(date),
      "Data da coleta deve ser hoje ou no futuro"
    ),
});

export const coletaFiltersSchema = z.object({
  q: z.string().optional(),
  status: z
    .enum(["all", "agendada", "reagendada", "concluida", "cancelada"])
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sort: z
    .enum([
      "scheduledFor_asc",
      "scheduledFor_desc",
      "created_asc",
      "created_desc",
    ])
    .optional(),
});

export type ColetaCreateData = z.infer<typeof coletaCreateSchema>;
export type ColetaUpdateData = z.infer<typeof coletaUpdateSchema>;
export type ColetaFiltersData = z.infer<typeof coletaFiltersSchema>;
