import { z } from 'zod';

// Validação de CNPJ (formato 14 dígitos)
const cnpjSchema = z
  .string({ message: 'CNPJ é obrigatório' })
  .min(14, 'CNPJ deve ter 14 dígitos')
  .max(18, 'CNPJ inválido')
  .refine((val) => {
    const digits = val.replace(/\D/g, '');
    return digits.length === 14;
  }, 'CNPJ deve ter 14 dígitos');

// Validação condicional de PIX
const pixMethodSchema = z.object({
  kind: z.literal('pix'),
  pixType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random'], {
    message: 'Tipo de chave PIX inválido',
  }),
  pixKey: z.string().min(1, 'Chave PIX é obrigatória'),
}).refine((data) => {
  const { pixType, pixKey } = data;

  if (pixType === 'email') {
    return z.string().email().safeParse(pixKey).success;
  }

  if (pixType === 'phone') {
    return /^\+?\d{10,14}$/.test(pixKey.replace(/\D/g, ''));
  }

  if (pixType === 'cpf') {
    const digits = pixKey.replace(/\D/g, '');
    return digits.length === 11;
  }

  if (pixType === 'cnpj') {
    const digits = pixKey.replace(/\D/g, '');
    return digits.length === 14;
  }

  if (pixType === 'random') {
    // UUID-like ou 32 chars
    return pixKey.length >= 32 || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pixKey);
  }

  return true;
}, {
  message: 'Chave PIX inválida para o tipo selecionado',
  path: ['pixKey'],
});

// Validação de transferência bancária
const transferMethodSchema = z.object({
  kind: z.literal('transfer'),
  bankCode: z.string().min(3, 'Código do banco deve ter pelo menos 3 dígitos').max(8, 'Código do banco inválido'),
  branch: z.string().min(1, 'Agência é obrigatória'),
  account: z.string().min(1, 'Conta é obrigatória'),
  accountType: z.enum(['corrente', 'poupanca'], {
    message: 'Tipo de conta inválido',
  }),
  holderName: z.string().min(3, 'Nome do titular é obrigatório'),
  holderDocument: z.string().min(14, 'CNPJ do titular deve ter 14 dígitos').max(18, 'CNPJ inválido'),
});

// Schema principal
export const pickupPointSchema = z.object({
  // PJ
  razaoSocial: z
    .string({ message: "Razão Social é obrigatória" })
    .min(3, "Razão Social deve ter pelo menos 3 caracteres"),
  nomeFantasia: z
    .string({ message: "Nome Fantasia é obrigatório" })
    .min(3, "Nome Fantasia deve ter pelo menos 3 caracteres"),
  cnpj: cnpjSchema,
  ie: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z
    .string()
    .regex(/^\+?\d{10,15}$/, "Telefone deve ter entre 10 e 15 dígitos")
    .optional()
    .or(z.literal("")),
  password: z
    .string({ message: "Senha é obrigatória" })
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .optional()
    .or(z.literal("")),

  // Endereço (flat)
  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido")
    .optional()
    .or(z.literal("")),
  logradouro: z.string().optional().or(z.literal("")),
  numero: z.string().optional().or(z.literal("")),
  complemento: z.string().optional().or(z.literal("")),
  bairro: z.string().optional().or(z.literal("")),
  cidade: z.string().optional().or(z.literal("")),
  uf: z
    .string()
    .length(2, "UF deve ter 2 letras")
    .regex(/^[A-Z]{2}$/, "UF inválida")
    .optional()
    .or(z.literal("")),

  // Geolocalização (opcional)
  geo: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable()
    .optional(),

  // Pagamento
  paymentMethod: z.discriminatedUnion("kind", [
    pixMethodSchema,
    transferMethodSchema,
  ]),
  payoutDay: z
    .number()
    .int()
    .min(1, "Dia deve ser entre 1 e 28")
    .max(28, "Dia deve ser entre 1 e 28")
    .optional(),
  minPayoutAmount: z
    .number()
    .min(0, "Valor mínimo deve ser maior ou igual a 0")
    .optional(),
  commissionPerItem: z
    .number()
    .min(0, "Valor inválido")
    .max(999999, "Valor muito alto")
    .nullable()
    .optional(),

  // Operação
  capacityPerDay: z
    .number()
    .int()
    .min(0, "Capacidade deve ser maior ou igual a 0")
    .nullable()
    .optional(),
})
  .refine(
    (data) => {
      // Se CEP preenchido, cidade deve estar preenchida
      if (data.cep && !data.cidade) {
        return false;
      }
      return true;
    },
    {
      message: "Cidade é obrigatória quando CEP está preenchido",
      path: ["cidade"],
    }
  );

export type PickupPointSchemaType = z.infer<typeof pickupPointSchema>;

// Schema de filtros
export const filtersSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'blocked', 'all']).optional(),
  uf: z.string().length(2).optional(),
  cidade: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(10),
  sort: z.enum(['name_asc', 'name_desc', 'updated_desc', 'updated_asc']).optional().default('updated_desc'),
});

export type FiltersSchemaType = z.infer<typeof filtersSchema>;
