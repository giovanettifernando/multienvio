import { z } from 'zod';

/**
 * Valida CEP brasileiro (8 dígitos)
 */
export function validateCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Normaliza CEP removendo máscara
 */
export function normalizeCEP(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Valida UF brasileira
 */
export function validateUF(uf: string): boolean {
  const validUFs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  return validUFs.includes(uf.toUpperCase());
}

/**
 * Schema Zod para criação/atualização de endereço
 */
export const AddressSchema = z.object({
  label: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return val.trim();
    }),

  cep: z
    .string({ message: 'CEP é obrigatório' })
    .transform(normalizeCEP)
    .refine(validateCEP, { message: 'CEP inválido (deve ter 8 dígitos)' }),

  logradouro: z
    .string({ message: 'Logradouro é obrigatório' })
    .min(3, 'Logradouro deve ter no mínimo 3 caracteres')
    .max(200, 'Logradouro deve ter no máximo 200 caracteres')
    .trim()
    .transform((val) => val.replace(/\s+/g, ' ')),

  numero: z
    .string({ message: 'Número é obrigatório' })
    .min(1, 'Número é obrigatório')
    .max(10, 'Número deve ter no máximo 10 caracteres')
    .trim(),

  complemento: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return val.trim().replace(/\s+/g, ' ');
    }),

  bairro: z
    .string({ message: 'Bairro é obrigatório' })
    .min(2, 'Bairro deve ter no mínimo 2 caracteres')
    .max(100, 'Bairro deve ter no máximo 100 caracteres')
    .trim()
    .transform((val) => val.replace(/\s+/g, ' ')),

  cidade: z
    .string({ message: 'Cidade é obrigatória' })
    .min(2, 'Cidade deve ter no mínimo 2 caracteres')
    .max(100, 'Cidade deve ter no máximo 100 caracteres')
    .trim()
    .transform((val) => val.replace(/\s+/g, ' ')),

  uf: z
    .string({ message: 'UF é obrigatória' })
    .length(2, 'UF deve ter 2 caracteres')
    .transform((val) => val.toUpperCase())
    .refine(validateUF, { message: 'UF inválida' }),

  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof AddressSchema>;
