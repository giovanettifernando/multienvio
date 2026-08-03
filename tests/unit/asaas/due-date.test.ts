import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDueDate } from '@/platform/integrations/asaas/due-date';

describe('buildDueDate', () => {
  it('devolve o dia no formato YYYY-MM-DD', () => {
    const result = buildDueDate('pix', 3, new Date('2026-08-03T12:00:00Z'));
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('pix e cartão vencem hoje (dia local em America/Sao_Paulo)', () => {
    // 12:00 UTC = 09:00 em Brasília (UTC-3) — mesmo dia calendário nos dois fusos
    const now = new Date('2026-08-03T12:00:00Z');
    assert.equal(buildDueDate('pix', 3, now), '2026-08-03');
    assert.equal(buildDueDate('credit_card', 3, now), '2026-08-03');
  });

  it('boleto vence hoje + boletoDueDays', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    assert.equal(buildDueDate('boleto', 3, now), '2026-08-06');
    assert.equal(buildDueDate('boleto', 10, now), '2026-08-13');
  });

  it('boleto usa 3 dias por padrão quando boletoDueDays não é informado', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    assert.equal(buildDueDate('boleto', undefined, now), '2026-08-06');
  });

  it('meia-noite local: 23h de Brasília ainda cai no UTC do dia seguinte, mas o dueDate usa o dia local', () => {
    // 23:30 em Brasília (03/08) = 02:30 UTC do dia seguinte (04/08).
    // date.toISOString().slice(0, 10) (a implementação antiga, com o bug)
    // devolveria '2026-08-04' — um dia à frente do "hoje" real do usuário.
    const nowLocal2330 = new Date('2026-08-04T02:30:00Z');
    assert.equal(buildDueDate('pix', 3, nowLocal2330), '2026-08-03');
    assert.equal(buildDueDate('credit_card', 3, nowLocal2330), '2026-08-03');
    // boleto: hoje local (03/08) + 3 dias = 06/08, não 07/08
    assert.equal(buildDueDate('boleto', 3, nowLocal2330), '2026-08-06');
  });

  it('usa a hora real quando "now" não é informado', () => {
    const result = buildDueDate('pix');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });
});
