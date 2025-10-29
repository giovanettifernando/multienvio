import { z } from 'zod';
import type { CommissionModel, BankMethod } from './types';

const cnpjDigits = (value: string) => value.replace(/\D/g, '');
const cpfDigits = (value: string) => value.replace(/\D/g, '');

const optionalString = (message?: string) =>
  z
    .string({ message })
    .optional()
    .or(z.literal(''))
    .or(z.null())
    .transform((value) => (value == null || value === '' ? null : value));

const emailSchema = z
  .string()
  .email('E-mail inválido')
  .optional()
  .or(z.literal(''))
  .or(z.null())
  .transform((value) => (value == null || value === '' ? null : value));

const phoneSchema = z
  .string()
  .regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, 'Telefone deve ter entre 10 e 11 dígitos')
  .optional()
  .or(z.literal(''))
  .or(z.null())
  .transform((value) => (value == null || value === '' ? null : value));

const cepSchema = z
  .string()
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido')
  .optional()
  .or(z.literal(''))
  .or(z.null())
  .transform((value) => (value == null || value === '' ? null : value));

const today = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

// Endereço com regra de CEP (bloqueio de campos autocomplete)
const enderecoSchema = z.object({
  cep: cepSchema,
  logradouro: optionalString(),
  numero: optionalString(),
  complemento: optionalString(),
  bairro: optionalString(),
  cidade: optionalString(),
  uf: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.null())
    .transform((value) => (value ? value.toUpperCase() : null))
    .refine((value) => value === null || /^[A-Z]{2}$/.test(value), {
      message: 'UF deve ter 2 letras',
    }),
});

// 1) Cadastro PF
export const pfSchema = z.object({
  nome: z.string({ message: 'Nome completo é obrigatório' }).min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cnh: z.object({
    number: z.string({ message: 'Número da CNH é obrigatório' }).min(9, 'Número da CNH deve ter no mínimo 9 caracteres'),
    category: z
      .string({ message: 'Categoria é obrigatória' })
      .min(1, 'Categoria é obrigatória')
      .regex(/^[A-Z]{1,3}$/i, 'Categoria deve ter entre 1 e 3 letras')
      .transform((value) => value.toUpperCase()),
    expiresAt: z
      .string({ message: 'Validade é obrigatória' })
      .refine((value) => {
        const expires = new Date(value);
        if (Number.isNaN(expires.getTime())) return false;
        return expires >= today();
      }, 'Validade deve ser igual ou superior à data de hoje'),
  }),
  endereco: enderecoSchema,
  celular: z.string({ message: 'Celular é obrigatório' }).regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, 'Celular inválido'),
  whatsapp: optionalString(),
  usarMesmoNumero: z.boolean().optional().default(false),
});

// 2) Cadastro PJ (sem Nome Fantasia e IE)
const cnpjSchema = z
  .string({ message: 'CNPJ é obrigatório' })
  .min(14, 'CNPJ deve ter 14 dígitos')
  .refine((value) => cnpjDigits(value).length === 14, 'CNPJ deve ter 14 dígitos');

export const pjSchema = z.object({
  razaoSocial: z
    .string({ message: 'Razão Social é obrigatória' })
    .min(3, 'Razão Social deve ter pelo menos 3 caracteres'),
  cnpj: cnpjSchema,
  email: emailSchema,
  telefone: phoneSchema,
  endereco: enderecoSchema,
});

// 3) Veículo (sem upload de CRLV, com marca)
const plateSchema = z
  .string({ message: 'Placa é obrigatória' })
  .min(7, 'Placa inválida')
  .max(7, 'Placa inválida')
  .regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/i, 'Placa no padrão Mercosul (AAA0A00)')
  .transform((value) => value.toUpperCase());

const renavamSchema = z
  .string({ message: 'RENAVAM é obrigatório' })
  .regex(/^\d{9,11}$/, 'RENAVAM deve ter entre 9 e 11 dígitos');

export const vehicleSchema = z.object({
  plate: plateSchema,
  brand: z.string({ message: 'Marca é obrigatória' }).min(2, 'Marca deve ter pelo menos 2 caracteres'),
  model: optionalString(),
  year: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.null())
    .refine((value) => {
      if (!value) return true;
      return /^\d{4}$/.test(value);
    }, 'Ano deve ter 4 dígitos')
    .transform((value) => (value == null || value === '' ? null : value)),
  renavam: renavamSchema,
});

// 4) Documentos (uploads obrigatórios)
const fileRefSchema = z.object({
  uid: z.string(),
  name: z.string(),
  url: z.string().optional(),
  status: z.enum(['uploading', 'done', 'error']).optional(),
});

export const documentsSchema = z.object({
  cnhFiles: z.array(fileRefSchema).min(1, 'É necessário enviar pelo menos 1 arquivo da CNH'),
  crlvFile: z.array(fileRefSchema).min(1, 'Arquivo do CRLV é obrigatório'),
  pfAddressProofFile: z.array(fileRefSchema).min(1, 'Comprovante de endereço PF é obrigatório'),
});

// 5) Financeiro (PIX/Transferência + Comissão)
const requiresTwoDecimals = (value: number) => {
  if (!Number.isFinite(value)) return false;
  const normalized = Math.round(value * 100);
  return Number.isInteger(normalized);
};

const pixMethodSchema = z.object({
  kind: z.literal('pix'),
  pixType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random'], {
    message: 'Tipo de chave PIX inválido',
  }),
  pixKey: z.string({ message: 'Chave PIX é obrigatória' }).min(1, 'Chave PIX é obrigatória'),
}).refine((data) => {
  const { pixType, pixKey } = data;
  if (!pixKey) return false;

  if (pixType === 'email') {
    return z.string().email().safeParse(pixKey).success;
  }

  if (pixType === 'phone') {
    return /^\+?\d{10,15}$/.test(pixKey.replace(/\D/g, ''));
  }

  if (pixType === 'cpf') {
    return cpfDigits(pixKey).length === 11;
  }

  if (pixType === 'cnpj') {
    return cnpjDigits(pixKey).length === 14;
  }

  if (pixType === 'random') {
    return pixKey.length >= 32 || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pixKey);
  }

  return true;
}, {
  message: 'Chave PIX inválida para o tipo selecionado',
  path: ['pixKey'],
});

const transferMethodSchema = z.object({
  kind: z.literal('transfer'),
  bankCode: z.string({ message: 'Código do banco é obrigatório' }).length(3, 'Código do banco deve ter 3 dígitos'),
  branch: z.string({ message: 'Agência é obrigatória' }).min(1, 'Agência é obrigatória'),
  account: z.string({ message: 'Conta é obrigatória' }).min(1, 'Conta é obrigatória'),
  accountType: z.enum(['corrente', 'poupanca'], { message: 'Tipo de conta inválido' }),
  holderName: z.string({ message: 'Nome do titular é obrigatório' }).min(3, 'Nome do titular inválido'),
  holderCnpj: z
    .string({ message: 'CNPJ do titular é obrigatório' })
    .min(14, 'CNPJ deve ter 14 dígitos')
    .refine((value) => cnpjDigits(value).length === 14, 'CNPJ deve ter 14 dígitos'),
});

export const bankSchema: z.ZodType<BankMethod> = z.discriminatedUnion('kind', [pixMethodSchema, transferMethodSchema]);

const commissionSchema: z.ZodType<CommissionModel> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fixa'),
    amount: z
      .number()
      .min(0, 'Valor deve ser maior ou igual a 0')
      .refine((value) => requiresTwoDecimals(value), {
        message: 'Valor deve ter no máximo 2 casas decimais',
      }),
  }),
  z.object({
    kind: z.literal('porKm'),
    amountPerKm: z
      .number()
      .min(0, 'Valor deve ser maior ou igual a 0')
      .refine((value) => requiresTwoDecimals(value), {
        message: 'Valor deve ter no máximo 2 casas decimais',
      }),
  }),
]);

export const commissionSchemaExport = commissionSchema;

// Schema completo do formulário
export const collectorFormSchema = z.object({
  pf: pfSchema,
  pj: pjSchema,
  vehicle: vehicleSchema,
  documents: documentsSchema,
  bank: bankSchema,
  commission: commissionSchema,
});

export type CollectorFormSchemaType = z.infer<typeof collectorFormSchema>;
export type CollectorFormSchemaInput = z.input<typeof collectorFormSchema>;

// Legacy schema para compatibilidade (deprecated)
export const collectorSchema = collectorFormSchema;
export type CollectorSchemaType = CollectorFormSchemaType;
export type CollectorSchemaInput = CollectorFormSchemaInput;

export const filtersSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['all', 'active', 'blocked']).optional(),
  uf: z.string().length(2).optional(),
  cidade: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(10),
  sort: z.enum(['updated_desc', 'updated_asc', 'name_asc', 'name_desc']).optional().default('updated_desc'),
});

export type FiltersSchemaType = z.infer<typeof filtersSchema>;
