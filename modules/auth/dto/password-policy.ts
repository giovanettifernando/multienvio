/**
 * Password Policy Validation
 *
 * Implementa políticas de segurança para senhas de usuários.
 */

import { z } from 'zod';

/**
 * Top 10k most common passwords (subset for validation)
 * Em produção, isso deveria vir de um arquivo separado ou DB
 */
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'iloveyou', 'trustno1', '1234567890',
  'sunshine', 'master', 'welcome', 'shadow', 'ashley',
  'football', 'jesus', 'michael', 'ninja', 'mustang',
  'password1', 'abc123', 'admin', 'letmein', 'monkey',
]);

/**
 * Política mínima de senha
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 256,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  preventCommon: true,
  preventReuse: true,
  historyCount: 5, // Últimas 5 senhas não podem ser reutilizadas
} as const;

/**
 * Caracteres especiais permitidos
 */
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

/**
 * Resultado da validação de política de senha
 */
export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida se a senha atende à política de segurança
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];

  // Comprimento mínimo
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`A senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres`);
  }

  // Comprimento máximo
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`A senha deve ter no máximo ${PASSWORD_POLICY.maxLength} caracteres`);
  }

  // Letra maiúscula
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula');
  }

  // Letra minúscula
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minúscula');
  }

  // Número
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número');
  }

  // Caractere especial
  if (PASSWORD_POLICY.requireSpecial && !SPECIAL_CHARS.test(password)) {
    errors.push('A senha deve conter pelo menos um caractere especial (!@#$%^&*...)');
  }

  // Senha muito comum
  if (PASSWORD_POLICY.preventCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Esta senha é muito comum e não pode ser utilizada');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Schema Zod para validação de senha com política
 */
export const passwordPolicySchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `A senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres`)
  .max(PASSWORD_POLICY.maxLength, `A senha deve ter no máximo ${PASSWORD_POLICY.maxLength} caracteres`)
  .refine((val) => /[A-Z]/.test(val), {
    message: 'A senha deve conter pelo menos uma letra maiúscula',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'A senha deve conter pelo menos uma letra minúscula',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'A senha deve conter pelo menos um número',
  })
  .refine((val) => SPECIAL_CHARS.test(val), {
    message: 'A senha deve conter pelo menos um caractere especial (!@#$%^&*...)',
  })
  .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase()), {
    message: 'Esta senha é muito comum e não pode ser utilizada',
  });

/**
 * Schema para alteração de senha
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Senha atual é obrigatória')
      .max(256, 'Senha atual inválida'),
    newPassword: passwordPolicySchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da senha atual',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Verifica se a senha já foi utilizada anteriormente
 * @param newPasswordHash Hash da nova senha
 * @param passwordHistory Array de hashes de senhas anteriores (do mais recente ao mais antigo)
 * @param compareFunction Função para comparar hashes (ex: bcrypt.compare)
 */
export async function isPasswordReused(
  newPassword: string,
  passwordHistory: string[] | null,
  compareFunction: (password: string, hash: string) => Promise<boolean>
): Promise<boolean> {
  if (!PASSWORD_POLICY.preventReuse || !passwordHistory || passwordHistory.length === 0) {
    return false;
  }

  // Verifica contra o histórico
  const historyToCheck = passwordHistory.slice(0, PASSWORD_POLICY.historyCount);

  for (const oldHash of historyToCheck) {
    const matches = await compareFunction(newPassword, oldHash);
    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Atualiza o histórico de senhas
 * @param currentHash Hash da senha atual (que será adicionado ao histórico)
 * @param currentHistory Histórico atual de senhas
 * @returns Novo histórico atualizado
 */
export function updatePasswordHistory(
  currentHash: string | null,
  currentHistory: string[] | null
): string[] {
  if (!PASSWORD_POLICY.preventReuse) {
    return [];
  }

  const history = currentHistory || [];

  // Adiciona o hash atual ao início do histórico (se existir)
  if (currentHash) {
    history.unshift(currentHash);
  }

  // Mantém apenas os últimos N hashes
  return history.slice(0, PASSWORD_POLICY.historyCount);
}
