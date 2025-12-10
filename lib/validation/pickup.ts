import { z } from "zod";

export const pickupScheduleSchema = z
  .object({
    date: z
      .string()
      .min(10, "Informe a data"), // ex.: YYYY-MM-DD
    windowStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/u, "Horário inválido"),
    windowEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/u, "Horário inválido"),
  })
  .refine(
    (schedule) => schedule.windowEnd > schedule.windowStart,
    {
      path: ["windowEnd"],
      message: "Fim deve ser após o início",
    },
  );

export const pickupPayloadSchema = z.object({
  carrierPref: z
    .enum(["Correios", "Jadlog", "Loggi", "J&T", "ANY"])
    .default("ANY"),
  schedule: pickupScheduleSchema,
  notes: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional(),
  shipmentsIds: z
    .array(z.string())
    .min(1, "Selecione ao menos um envio"),
});

export type PickupPayload = z.infer<typeof pickupPayloadSchema>;
export type PickupSchedule = z.infer<typeof pickupScheduleSchema>;

/**
 * Schema para criação de pickup request via API /api/coletas
 */
export const createPickupRequestSchema = z.object({
  shipmentId: z.string().uuid('ID do envio inválido'),
  windowStart: z
    .string()
    .datetime({ message: 'Data/hora de início inválida' })
    .optional(),
  windowEnd: z
    .string()
    .datetime({ message: 'Data/hora de fim inválida' })
    .optional(),
  notes: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional(),
}).refine(
  (data) => {
    if (data.windowStart && data.windowEnd) {
      return new Date(data.windowEnd) > new Date(data.windowStart);
    }
    return true;
  },
  { path: ['windowEnd'], message: 'Fim deve ser após o início' }
);

export type CreatePickupRequestInput = z.infer<typeof createPickupRequestSchema>;

/**
 * Schema para query params da listagem de coletas
 */
export const listPickupsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  status: z.string().optional(), // PENDING,SCHEDULED,etc - comma separated
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional(),
  city: z.string().max(100).optional(),
  q: z.string().max(100).optional(),
});

export type ListPickupsQueryInput = z.infer<typeof listPickupsQuerySchema>;

/**
 * Schema para atualização de pickup request via PATCH /api/coletas/[id]
 */
export const updatePickupRequestSchema = z.object({
  status: z
    .enum(['PENDING', 'SCHEDULED', 'IN_TRANSIT', 'COLLECTED', 'CANCELLED', 'FAILED'])
    .optional(),
  windowStart: z
    .string()
    .datetime({ message: 'Data/hora de início inválida' })
    .nullable()
    .optional(),
  windowEnd: z
    .string()
    .datetime({ message: 'Data/hora de fim inválida' })
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .nullable()
    .optional(),
}).refine(
  (data) => {
    if (data.windowStart && data.windowEnd) {
      return new Date(data.windowEnd) > new Date(data.windowStart);
    }
    return true;
  },
  { path: ['windowEnd'], message: 'Fim deve ser após o início' }
);

export type UpdatePickupRequestInput = z.infer<typeof updatePickupRequestSchema>;

/**
 * Schema para cálculo de taxa de coleta via POST /api/pickup-fee/calculate
 */
export const pickupFeeCalculateSchema = z.object({
  originCep: z
    .string({ message: 'CEP de origem é obrigatório' })
    .min(1, 'CEP de origem é obrigatório')
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, 'CEP de origem inválido'),
  freightCost: z
    .number({ message: 'Custo do frete é obrigatório' })
    .nonnegative('Custo do frete deve ser zero ou positivo'),
});

export type PickupFeeCalculateInput = z.infer<typeof pickupFeeCalculateSchema>;
