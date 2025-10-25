import { z } from "zod";

export const destinatarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do destinatário"),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido")
    .optional(),
  telefone: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/u.test(value),
      "Telefone inválido",
    ),
  cep: z
    .string()
    .min(1, "Informe o CEP")
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP inválido"),
  logradouro: z
    .string()
    .trim()
    .min(3, "Informe o logradouro"),
  numero: z
    .string()
    .trim()
    .min(1, "Informe o número"),
  complemento: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
  bairro: z
    .string()
    .trim()
    .min(2, "Informe o bairro"),
  cidade: z
    .string()
    .trim()
    .min(2, "Informe a cidade"),
  uf: z
    .string()
    .trim()
    .length(2, "UF inválida"),
});

export const pacoteSchema = z
  .object({
    pesoKg: z.coerce
      .number()
      .positive("Informe o peso")
      .max(30, "Peso máximo 30kg"),
    comprimentoCm: z.coerce
      .number()
      .positive()
      .max(100, "Comprimento máximo 100cm"),
    larguraCm: z.coerce
      .number()
      .positive()
      .max(100, "Largura máxima 100cm"),
    alturaCm: z.coerce
      .number()
      .positive()
      .max(100, "Altura máxima 100cm"),
  })
  .refine(
    (pacote) =>
      pacote.comprimentoCm >= 16 &&
      pacote.larguraCm >= 11 &&
      pacote.alturaCm >= 2,
    {
      message: "Dimensões mínimas não atendidas (16x11x2cm)",
      path: ["comprimentoCm"],
    },
  );

export const servicoSchema = z.object({
  serviceCode: z
    .string()
    .min(1, "Selecione um serviço"),
  declaredValue: z.coerce.number().min(0).optional(),
  avisoRecebimento: z.boolean().optional(),
  maoPropria: z.boolean().optional(),
});

export const shipmentSchema = z.object({
  cotacaoId: z.string().optional(),
  destinatario: destinatarioSchema,
  pacote: pacoteSchema,
  servico: servicoSchema,
});

export type DestinatarioData = z.infer<typeof destinatarioSchema>;
export type PacoteData = z.infer<typeof pacoteSchema>;
export type ServicoData = z.infer<typeof servicoSchema>;
export type ShipmentFormData = z.infer<typeof shipmentSchema>;
