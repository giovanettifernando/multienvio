import { z } from "zod";

export const orderCustomerSchema = z.object({
  name: z.string().min(3, "Informe o nome do cliente"),
  email: z.string().email("Informe um e-mail válido").optional(),
  phone: z
    .string()
    .regex(/^(\(?\d{2}\)?\s?\d{4,5}-?\d{4})$/u, "Telefone inválido")
    .optional(),
  doc: z.string().optional(),
  address: z.object({
    cep: z
      .string()
      .min(1, "Informe o CEP")
      .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP inválido"),
    logradouro: z
      .string()
      .min(3, "Informe o logradouro"),
    numero: z
      .string()
      .min(1, "Informe o número"),
    complemento: z.string().optional(),
    bairro: z
      .string()
      .min(2, "Informe o bairro"),
    cidade: z
      .string()
      .min(2, "Informe a cidade"),
    uf: z
      .string()
      .length(2, "UF inválida"),
  }),
});

export const orderPackageSchema = z
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
    declaredValue: z.coerce.number().min(0).default(0),
    category: z.enum(["ELETRONICOS", "ROUPAS", "GERAL"]).default("GERAL"),
  })
  .refine(
    (pacote) =>
      pacote.comprimentoCm >= 16 &&
      pacote.larguraCm >= 11 &&
      pacote.alturaCm >= 2,
    {
      path: ["comprimentoCm"],
      message: "Dimensões mínimas 16x11x2cm",
    },
  );

export const orderItemSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, "Informe a descrição"),
  qty: z.coerce
    .number()
    .int("Informe um número inteiro")
    .positive("Quantidade deve ser positiva"),
  unitPrice: z.coerce.number().min(0).optional(),
  weightKg: z.coerce.number().min(0).optional(),
  dims: z
    .object({
      C: z.coerce.number().min(0).optional(),
      L: z.coerce.number().min(0).optional(),
      A: z.coerce.number().min(0).optional(),
    })
    .optional(),
});

export const orderSchema = z.object({
  customer: orderCustomerSchema,
  package: orderPackageSchema,
  preferences: z
    .object({
      prioridade: z.number().min(0).max(100).default(25),
      adicionais: z
        .object({
          seguro: z.boolean().optional(),
          avisoRecebimento: z.boolean().optional(),
          maoPropria: z.boolean().optional(),
        })
        .default({}),
      usarTabelaContratada: z.boolean().optional(),
      carrierFilter: z
        .array(z.enum(["Correios", "Jadlog", "Loggi", "J&T"]))
        .optional(),
    })
    .optional(),
  items: z.array(orderItemSchema).optional(),
  nf: z
    .object({
      number: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderCustomerInput = z.infer<typeof orderCustomerSchema>;
export type OrderPackageInput = z.infer<typeof orderPackageSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
