import { z } from "zod";
import { onlyDigits } from "@/lib/masks";
import { isValidCPF, isValidCNPJ } from "@/lib/validation/utils";

export const regimeTributarioOptions = ["SIMPLES", "PRESUMIDO", "REAL"] as const;

const documentoError = {
  cpf: "CPF inválido",
  cnpj: "CNPJ inválido",
};

const pessoaSchema = z.object({
  nomeCompleto: z
    .string()
    .trim()
    .min(3, "Informe o nome completo"),
  cpf: z
    .string()
    .trim()
    .min(1, documentoError.cpf)
    .superRefine((value, ctx) => {
      const digits = onlyDigits(value);
      if (!isValidCPF(digits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: documentoError.cpf,
        });
      }
    }),
  rg: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
});

export const empresaSchema = z.object({
  razao: z
    .string()
    .trim()
    .min(3, "Informe a razão social"),
  fantasia: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
  cnpj: z
    .string()
    .trim()
    .min(1, documentoError.cnpj)
    .superRefine((value, ctx) => {
      const digits = onlyDigits(value);
      if (!isValidCNPJ(digits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: documentoError.cnpj,
        });
      }
    }),
  ie: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
  regime: z
    .enum(regimeTributarioOptions)
    .default("SIMPLES"),
});

export const enderecoSchema = z.object({
  cep: z
    .string()
    .trim()
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
  telefone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
});

const dimensoesSchema = z
  .object({
    largura: z.number().positive().nullable().optional(),
    altura: z.number().positive().nullable().optional(),
    profundidade: z.number().positive().nullable().optional(),
    peso: z.number().positive().nullable().optional(),
  })
  .partial()
  .default({});

export const preferenciasSchema = z.object({
  remetente: z.string().trim().min(1, "Informe o nome do remetente"),
  emailNotificacoes: z
    .string()
    .trim()
    .email("E-mail inválido"),
  dimPadrao: dimensoesSchema,
  aceite: z
    .boolean()
    .default(false)
    .refine((value) => value === true, {
      message: "É necessário aceitar os termos.",
    }),
});

const baseSchema = z.object({
  endereco: enderecoSchema,
  preferencias: preferenciasSchema,
});

const pfSchema = baseSchema.extend({
  tipoPessoa: z.literal("PF"),
  pessoa: pessoaSchema,
  // mantemos o ramo PJ opcional para retrocompatibilidade de form state
  empresa: empresaSchema.partial().optional(),
});

const pjSchema = baseSchema.extend({
  tipoPessoa: z.literal("PJ"),
  empresa: empresaSchema,
  // mantemos o ramo PF opcional para retrocompatibilidade de form state
  pessoa: pessoaSchema.partial().optional(),
});

const discriminatedSchema = z.discriminatedUnion("tipoPessoa", [pfSchema, pjSchema]);

export const companyWizardSchema = z.preprocess((input) => {
  if (typeof input === "object" && input !== null && !("tipoPessoa" in input)) {
    // payloads legados (apenas PJ) viram PJ por padrão
    return { tipoPessoa: "PJ", ...input };
  }
  return input;
}, discriminatedSchema);

export type PessoaData = z.infer<typeof pessoaSchema>;
export type EmpresaData = z.infer<typeof empresaSchema>;
export type EnderecoData = z.infer<typeof enderecoSchema>;
export type PreferenciasData = z.infer<typeof preferenciasSchema>;
export type CompanyWizardData = z.infer<typeof companyWizardSchema>;

export { getCompanyDisplayName, getCompanyDocument } from "./utils";
