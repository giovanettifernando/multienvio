import { randomUUID } from "crypto";
import type { SupportTicket } from "./types";

type TimelineEventType = SupportTicket["timeline"][number];

const now = () => new Date().toISOString();

function createTimelineEvent(partial: Omit<TimelineEventType, "id" | "at">): TimelineEventType {
  return { id: randomUUID(), at: now(), ...partial };
}

const seedTickets: SupportTicket[] = [
  {
    id: "TCK-2025-987154",
    title: "Erro na integração via API - pedidos não sincronizam",
    description:
      "Desde ontem à noite, os pedidos criados no meu ERP não estão aparecendo no Envio Legal. Preciso de ajuda urgente.",
    status: "aberto",
    category: "integracao",
    requester: {
      name: "Mariana Almeida",
      email: "mariana@lojafit.com",
      phone: "+55 11 99888-7766",
      userId: "client-001",
    },
    linkedTrackingCode: "BR123456789BR",
    createdAt: "2025-02-18T09:20:00.000Z",
    updatedAt: "2025-02-18T09:20:00.000Z",
    slaDueAt: "2025-02-19T09:20:00.000Z",
    timeline: [
      {
        id: randomUUID(),
        type: "created",
        author: "cliente",
        message: "Ticket criado pelo cliente Mariana Almeida.",
        at: "2025-02-18T09:20:00.000Z",
      },
      {
        id: randomUUID(),
        type: "comment",
        author: "cliente",
        message:
          "Segue print da tela com o erro 504. Preciso enviar os pedidos ainda hoje.",
        at: "2025-02-18T09:21:15.000Z",
      },
    ],
  },
  {
    id: "TCK-2025-654810",
    title: "Conciliar pagamento manualmente",
    description:
      "Uma etiqueta foi paga via transferência, mas não consta como confirmada.",
    status: "pendente",
    category: "pagamento",
    requester: {
      name: "Lucas Pereira",
      email: "financeiro@lojaverde.com",
      phone: "+55 41 99812-3344",
      userId: "client-014",
    },
    assigneeUserId: "admin-003",
    createdAt: "2025-02-17T14:05:00.000Z",
    updatedAt: "2025-02-18T11:10:00.000Z",
    slaDueAt: null,
    timeline: [
      {
        id: randomUUID(),
        type: "created",
        author: "cliente",
        message: "Ticket criado pelo cliente Lucas Pereira.",
        at: "2025-02-17T14:05:00.000Z",
      },
      {
        id: randomUUID(),
        type: "assign",
        author: "suporte",
        message: "Ticket atribuído a Ana Souza.",
        at: "2025-02-17T14:20:00.000Z",
      },
      {
        id: randomUUID(),
        type: "comment",
        author: "suporte",
        message:
          "Olá Lucas, recebemos o comprovante. Vamos validar com o financeiro e retornamos em breve.",
        at: "2025-02-18T11:10:00.000Z",
      },
    ],
  },
  {
    id: "TCK-2025-333812",
    title: "Coleta não realizada - precisa reagendar",
    description:
      "A transportadora não compareceu ontem. Preciso reagendar a coleta para hoje ainda.",
    status: "respondido",
    category: "coleta",
    requester: {
      name: "Eduardo Santos",
      email: "logistica@techhouse.com",
      phone: "+55 31 98888-1234",
      userId: "client-029",
    },
    createdAt: "2025-02-16T08:40:00.000Z",
    updatedAt: "2025-02-17T10:15:00.000Z",
    slaDueAt: null,
    timeline: [
      {
        id: randomUUID(),
        type: "created",
        author: "cliente",
        message: "Ticket criado pelo cliente Eduardo Santos.",
        at: "2025-02-16T08:40:00.000Z",
      },
      {
        id: randomUUID(),
        type: "status",
        author: "suporte",
        message: "Status alterado para respondido.",
        at: "2025-02-17T10:10:00.000Z",
      },
      {
        id: randomUUID(),
        type: "comment",
        author: "suporte",
        message:
          "Olá Eduardo, reagendamos a coleta para hoje às 15h. Caso precise ajustar o horário, avise por aqui.",
        at: "2025-02-17T10:15:00.000Z",
      },
    ],
  },
];

export const supportDb = {
  tickets: seedTickets,
  listTickets(): SupportTicket[] {
    return this.tickets;
  },
  findTicket(id: string): SupportTicket | undefined {
    return this.tickets.find((ticket) => ticket.id === id);
  },
  createTicket(
    ticket: Omit<SupportTicket, "id" | "timeline" | "createdAt" | "updatedAt"> & {
      timeline?: TimelineEventType[];
    },
    options?: { id?: string; createdAt?: string },
  ): SupportTicket {
    const createdAt = options?.createdAt ?? now();
    const id =
      options?.id ?? `TCK-${createdAt.slice(0, 4)}-${Math.floor(Math.random() * 900000 + 100000)}`;
    const timeline =
      ticket.timeline && ticket.timeline.length > 0
        ? ticket.timeline
        : [
            createTimelineEvent({
              type: "created",
              author: "cliente",
              message: `Ticket criado pelo cliente ${ticket.requester.name}.`,
            }),
          ];
    const latestAt = timeline.reduce<string>(
      (latest, event) => {
        if (!latest) return event.at;
        return new Date(event.at).getTime() > new Date(latest).getTime() ? event.at : latest;
      },
      createdAt,
    );
    const newTicket: SupportTicket = {
      ...ticket,
      id,
      timeline,
      createdAt,
      updatedAt: latestAt ?? createdAt,
    };
    this.tickets.unshift(newTicket);
    return newTicket;
  },
  updateTicket(
    id: string,
    updates: Partial<
      Pick<SupportTicket, "status" | "category" | "assigneeUserId" | "linkedTrackingCode">
    >,
  ): SupportTicket | undefined {
    const ticket = this.findTicket(id);
    if (!ticket) return undefined;
    Object.assign(ticket, updates);
    ticket.updatedAt = now();
    return ticket;
  },
  addTimelineEvent(id: string, event: Omit<TimelineEventType, "id" | "at">) {
    const ticket = this.findTicket(id);
    if (!ticket) return undefined;
    const entry = createTimelineEvent(event);
    ticket.timeline.unshift(entry);
    ticket.updatedAt = entry.at;
    return entry;
  },
};

export function resetSupportDb(
  data: Array<SupportTicket>,
  options?: { replace?: boolean },
) {
  if (options?.replace) {
    supportDb.tickets = data;
  } else {
    supportDb.tickets.splice(0, supportDb.tickets.length, ...data);
  }
}
