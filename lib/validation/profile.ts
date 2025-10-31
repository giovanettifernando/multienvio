import { z } from 'zod';

/**
 * Valida CPF brasileiro usando o algoritmo de checksum
 */
export function validateCPF(cpf: string): boolean {
  // Remove não-dígitos
  const cleaned = cpf.replace(/\D/g, '');

  // CPF deve ter 11 dígitos
  if (cleaned.length !== 11) return false;

  // Rejeita CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  const digit1 = remainder >= 10 ? 0 : remainder;

  if (digit1 !== parseInt(cleaned.charAt(9))) return false;

  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  const digit2 = remainder >= 10 ? 0 : remainder;

  if (digit2 !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

/**
 * Normaliza CPF removendo máscara
 */
export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida CNPJ brasileiro usando o algoritmo de checksum
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remove não-dígitos
  const cleaned = cnpj.replace(/\D/g, '');

  // CNPJ deve ter 14 dígitos
  if (cleaned.length !== 14) return false;

  // Rejeita CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Valida primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (digit1 !== parseInt(cleaned.charAt(12))) return false;

  // Valida segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  if (digit2 !== parseInt(cleaned.charAt(13))) return false;

  return true;
}

/**
 * Normaliza CNPJ removendo máscara
 */
export function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Normaliza telefone removendo máscara (apenas números)
 * @param phone - Telefone com ou sem máscara
 * @returns Telefone sem máscara (apenas dígitos) ou null se vazio
 */
export function normalizePhone(phone: string): string | null {
  // Remove tudo que não é dígito
  const cleaned = phone.replace(/\D/g, '');

  // Retorna apenas os dígitos, sem adicionar +55
  if (cleaned.length === 10 || cleaned.length === 11) {
    return cleaned;
  }

  return null;
}

/**
 * Normaliza telefone brasileiro para formato E.164 (DEPRECATED - não usar)
 * @deprecated Use normalizePhone() instead
 */
export function normalizePhoneE164(phone: string): string | null {
  // Remove tudo que não é dígito
  const cleaned = phone.replace(/\D/g, '');

  // Telefone brasileiro: 10 ou 11 dígitos (com ou sem 9º dígito)
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `+55${cleaned}`;
  }

  // Se já está no formato +55...
  if (phone.startsWith('+55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return `+55${cleaned.substring(2)}`;
  }

  return null;
}

/**
 * Valida formato de telefone brasileiro
 */
export function isValidBrazilianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');

  // Aceita 10 ou 11 dígitos
  if (cleaned.length !== 10 && cleaned.length !== 11) return false;

  // DDD deve ser entre 11 e 99
  const ddd = parseInt(cleaned.substring(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  return true;
}

/**
 * Schema Zod para atualização de perfil
 */
export const UpdateProfileSchema = z.object({
  name: z
    .string({ message: 'Nome é obrigatório' })
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(120, 'Nome deve ter no máximo 120 caracteres')
    .trim()
    .transform((val) => val.replace(/\s+/g, ' ')), // Colapsar espaços

  phone: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return val;
    })
    .refine(
      (val) => {
        if (!val) return true; // null/undefined é válido (opcional)
        return isValidBrazilianPhone(val);
      },
      { message: 'Telefone inválido' }
    )
    .transform((val) => {
      if (!val) return null;
      return normalizePhone(val); // Remove máscara, SEM adicionar +55
    }),

  cpf: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return normalizeCPF(val);
    })
    .refine(
      (val) => {
        if (!val) return true; // null/undefined é válido (opcional)
        return validateCPF(val);
      },
      { message: 'CPF inválido' }
    ),

  avatarUrl: z
    .string()
    .url('URL do avatar inválida')
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return val;
    }),

  // Campos de empresa
  hasCompany: z.boolean().optional().default(false),

  cnpj: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return normalizeCNPJ(val);
    })
    .refine(
      (val) => {
        if (!val) return true; // null/undefined é válido (opcional)
        return validateCNPJ(val);
      },
      { message: 'CNPJ inválido' }
    ),

  razaoSocial: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      return val?.trim().replace(/\s+/g, ' ');
    }),

  // Email não pode ser alterado via API
  // Campo removido do schema - será rejeitado no backend se vier no body
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
