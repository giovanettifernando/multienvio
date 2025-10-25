Projeto Envio Legal — módulo Suporte (Tickets). Objetivo: Tickets com lista, criação, detalhe (timeline), anexos, vínculos (pedido/envio/etiqueta), prioridade, SLA e webhooks. Persistência em memória (globalThis).

Tipos essenciais:
TicketStatus: OPEN|PENDING|WAITING_CUSTOMER|RESOLVED|CLOSED
TicketPriority: LOW|NORMAL|HIGH|URGENT
TicketCategory: FINANCEIRO|LOGISTICA|ETIQUETA|RASTREAMENTO|COLETAS|OUTROS
TicketEvent: CREATED|STATUS_CHANGED|ASSIGNED|COMMENT|ATTACHMENT|SLA_BREACH|NOTE (author: USER|AGENT|SYSTEM)

SLA por prioridade (horas): LOW=72, NORMAL=48, HIGH=24, URGENT=4
dueAt = createdAt + targetHrs, breached se agora > dueAt e status não é RESOLVED/CLOSED.
Número do ticket: TCK-YYYY-######.

Persistência global:
g.__tickets: Map<string, Ticket>
g.__attachments: Map<string, SupportAttachment[]>

Boas práticas:
- AntD + RHF + Zod + TanStack Query.
- Mensagens pt-BR, acessibilidade básica, nenhum any, AntD v5 (usar variant, styles.body).
- Idempotente: se arquivo existir, apenas completar; não reescrever código fora do escopo.
