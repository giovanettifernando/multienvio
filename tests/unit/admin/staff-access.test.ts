import assert from 'node:assert';
import test from 'node:test';
import { AdminPermission } from '@prisma/client';
import { exigirPodeConceder, exigirPodeGerenciar } from '@/modules/admin/application/staff-access';

const superAdmin = { staffId: 'sa', isSuperAdmin: true, permissions: [] as AdminPermission[] };
const gestor = { staffId: 'g1', isSuperAdmin: false, permissions: ['USUARIOS', 'OPERACOES'] as AdminPermission[] };

const proibido = (fn: () => void, mensagem: RegExp) =>
  assert.throws(fn, (e: any) => e.status === 403 && mensagem.test(e.message));

test.describe('regras de acesso da equipe', () => {
  test('só super admin mexe em super admin', () => {
    proibido(() => exigirPodeGerenciar(gestor, { id: 'sa2', isSuperAdmin: true }, { mudaAcesso: false }), /super admin/);
    assert.doesNotThrow(() => exigirPodeGerenciar(superAdmin, { id: 'sa2', isSuperAdmin: true }, { mudaAcesso: true }));
  });

  test('ninguém muda o próprio acesso', () => {
    proibido(() => exigirPodeGerenciar(gestor, { id: 'g1', isSuperAdmin: false }, { mudaAcesso: true }), /próprio acesso/);
    proibido(() => exigirPodeGerenciar(superAdmin, { id: 'sa', isSuperAdmin: true }, { mudaAcesso: true }), /próprio acesso/);
  });

  test('editar os próprios dados (nome, telefone) continua liberado', () => {
    assert.doesNotThrow(() => exigirPodeGerenciar(gestor, { id: 'g1', isSuperAdmin: false }, { mudaAcesso: false }));
  });

  test('gestor comum gerencia staff comum', () => {
    assert.doesNotThrow(() => exigirPodeGerenciar(gestor, { id: 'x', isSuperAdmin: false }, { mudaAcesso: true }));
  });

  test('só super admin concede super admin', () => {
    proibido(() => exigirPodeConceder(gestor, { isSuperAdmin: true, permissions: [] }), /super admin/);
    assert.doesNotThrow(() => exigirPodeConceder(superAdmin, { isSuperAdmin: true, permissions: [] }));
  });

  test('ninguém concede permissão que não tem', () => {
    proibido(() => exigirPodeConceder(gestor, { isSuperAdmin: false, permissions: ['OPERACOES', 'FINANCEIRO'] as AdminPermission[] }), /que você tem/);
    assert.doesNotThrow(() => exigirPodeConceder(gestor, { isSuperAdmin: false, permissions: ['OPERACOES'] as AdminPermission[] }));
    assert.doesNotThrow(() => exigirPodeConceder(superAdmin, { isSuperAdmin: false, permissions: ['FINANCEIRO'] as AdminPermission[] }));
  });
});
