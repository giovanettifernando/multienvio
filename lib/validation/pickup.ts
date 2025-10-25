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
