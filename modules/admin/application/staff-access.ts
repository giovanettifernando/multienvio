import type { AdminPermission } from '@prisma/client';
import { ApiError } from '@/platform/api/errors';

/**
 * Regras de quem pode mexer no acesso de quem, na gestão da equipe do painel.
 *
 * A permissão USUARIOS permite gerenciar a equipe, mas sem estas regras quem a
 * tinha podia se promover a super admin, criar uma conta com todas as
 * permissões ou redefinir a senha de um super admin e entrar como ele.
 */

type Ator = { staffId: string; isSuperAdmin: boolean; permissions: AdminPermission[] };
type Alvo = { id: string; isSuperAdmin: boolean };

function proibido(message: string): never {
  throw new ApiError({ code: 'forbidden', message, status: 403 });
}

/**
 * Pode agir sobre este membro da equipe?
 * - só um super admin mexe em outro super admin (editar, bloquear, excluir, senha)
 * - ninguém muda o próprio acesso (status, permissões, super admin) nem se exclui
 */
export function exigirPodeGerenciar(ator: Ator, alvo: Alvo, { mudaAcesso }: { mudaAcesso: boolean }): void {
  if (alvo.isSuperAdmin && !ator.isSuperAdmin) {
    proibido('Só um super admin pode alterar outro super admin.');
  }
  if (mudaAcesso && alvo.id === ator.staffId) {
    proibido('Você não pode alterar o próprio acesso.');
  }
}

/**
 * Pode conceder este acesso?
 * - só um super admin concede super admin
 * - ninguém concede permissão que não tem
 */
export function exigirPodeConceder(
  ator: Ator,
  acesso: { isSuperAdmin: boolean; permissions: AdminPermission[] }
): void {
  if (ator.isSuperAdmin) return;
  if (acesso.isSuperAdmin) {
    proibido('Só um super admin pode tornar alguém super admin.');
  }
  const semDireito = acesso.permissions.filter((p) => !ator.permissions.includes(p));
  if (semDireito.length > 0) {
    proibido(`Você só pode conceder permissões que você tem (${semDireito.join(', ')}).`);
  }
}
