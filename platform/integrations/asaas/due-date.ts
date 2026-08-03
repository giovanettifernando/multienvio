/**
 * Vencimento de cobrança Asaas: hoje para PIX e cartão; prazo configurável para boleto.
 *
 * O "hoje" precisa ser o dia calendário em horário do Brasil (America/Sao_Paulo,
 * UTC-3), não em UTC. `date.toISOString().slice(0, 10)` usa o dia em UTC — entre
 * 21h e meia-noite no horário local, isso já é o dia seguinte, o que gera
 * dueDate de amanhã para PIX/cartão e um dia a mais que `boletoDueDays` pedido
 * para boleto. `Intl.DateTimeFormat` com `timeZone` explícito evita esse desvio
 * sem depender de nenhuma lib nova.
 */
export function buildDueDate(method: string, boletoDueDays = 3, now: Date = new Date()): string {
  const date = new Date(now);
  if (method === 'boleto') date.setDate(date.getDate() + boletoDueDays);
  // en-CA formata como YYYY-MM-DD; o timeZone garante o dia local correto
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
