"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Flex,
  Form,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Button,
} from "antd";
import { SupportStatus, SupportPriority } from "@/types/contracts";
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from "@/types/support";
import { TicketStatusTag } from "@/components/support/TicketStatusTag";

const statusOptions: Array<{ label: string; value: TicketStatus }> = [
  { label: "Aberto", value: SupportStatus.ABERTO },
  { label: "Em Atendimento", value: SupportStatus.EM_ATENDIMENTO },
  { label: "Resolvido", value: SupportStatus.RESOLVIDO },
  { label: "Fechado", value: SupportStatus.FECHADO },
];

const priorityOptions: Array<{ label: string; value: TicketPriority }> = [
  { label: "Baixa", value: SupportPriority.BAIXA },
  { label: "Média", value: SupportPriority.MEDIA },
  { label: "Alta", value: SupportPriority.ALTA },
  { label: "Crítica", value: SupportPriority.CRITICA },
];

const categoryOptions: Array<{ label: string; value: TicketCategory }> = [
  { label: "Financeiro", value: "FINANCEIRO" },
  { label: "Logística", value: "LOGISTICA" },
  { label: "Etiqueta", value: "ETIQUETA" },
  { label: "Rastreamento", value: "RASTREAMENTO" },
  { label: "Coletas", value: "COLETAS" },
  { label: "Outros", value: "OUTROS" },
];

const priorityLabelMap = priorityOptions.reduce<Record<TicketPriority, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<TicketPriority, string>,
);

const categoryLabelMap = categoryOptions.reduce<Record<TicketCategory, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<TicketCategory, string>,
);

type Agent = {
  id: string;
  name: string;
};

type Props = {
  ticket: Ticket;
  availableAgents?: Agent[];
  currentAgent?: Agent;
  mode?: 'client' | 'admin';
};

function buildAssigneeOptions(ticket: Ticket, agents: Agent[], currentAgent?: Agent) {
  const uniqueAgents = new Map<string, Agent>();

  agents.forEach((agent) => uniqueAgents.set(agent.id, agent));
  if (ticket.assignee) {
    uniqueAgents.set(ticket.assignee.id, ticket.assignee);
  }
  if (currentAgent) {
    uniqueAgents.set(currentAgent.id, currentAgent);
  }

  return [
    { label: "Sem atribuição", value: "unassigned" },
    ...Array.from(uniqueAgents.values()).map((agent) => ({
      label: agent.name,
      value: agent.id,
    })),
  ];
}

function formatSla(ticket: Ticket) {
  if (!ticket.sla) {
    return null;
  }

  const dueDate = new Date(ticket.sla.dueAt);
  const breached = ticket.sla.breached ?? false;
  const color = breached ? "red" : "blue";

  return (
    <Badge
      color={color}
      text={
        <Typography.Text type={breached ? "danger" : "secondary"}>
          SLA até {dueDate.toLocaleString("pt-BR")}
          {breached ? " • Vencido" : ""}
        </Typography.Text>
      }
    />
  );
}

export function TicketDetailHeader({ ticket, availableAgents = [], currentAgent, mode = 'admin' }: Props) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  useEffect(() => {
    if (mode === 'admin') {
      form.setFieldsValue({
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        assignee: ticket.assignee?.id ?? "unassigned",
      });
    }
  }, [ticket, form, mode]);

  const mutation = useMutation<Ticket, Error, Partial<Ticket>>({
  mutationFn: async (values: Partial<Ticket>) => {
    const response = await fetch(`/api/support/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.mensagem ?? "Não foi possível atualizar o ticket");
    }
    return (await response.json()) as Ticket;
  },
  onSuccess: (updatedTicket) => {
    message.success("Ticket atualizado");
    queryClient.setQueryData(["ticket", ticket.id], updatedTicket);
  },
  onError: (error) => {
    message.error(error.message);
  },
});


  const handleSubmit = (changed: Partial<Ticket>) => {
    if (mode === 'admin') {
      mutation.mutate(changed);
    }
  };

  const assigneeOptions = mode === 'admin' ? buildAssigneeOptions(ticket, availableAgents, currentAgent) : [];

  return (
    <Card
      variant="borderless"
      styles={{ body: { paddingBlock: 20, paddingInline: 24 } }}
      role="region"
      aria-label="Detalhes do ticket"
    >
      <Flex justify="space-between" align="center" wrap gap={16}>
        <Space direction="vertical" size={6}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {ticket.number}
          </Typography.Title>
          <Space size={8} align="center">
            <TicketStatusTag status={ticket.status} />
            <Tag color="gold">{categoryLabelMap[ticket.category]}</Tag>
            {ticket.priority && <Tag color="purple">{priorityLabelMap[ticket.priority]}</Tag>}
          </Space>
          {formatSla(ticket)}
        </Space>

        {mode === 'admin' && (
          <Flex gap={16} wrap align="center">
            <Form
              form={form}
              layout="inline"
              initialValues={{
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category,
                assignee: ticket.assignee?.id ?? "unassigned",
              }}
              onValuesChange={(changedValues) => {
                const entries = Object.entries(changedValues) as Array<[string, unknown]>;
                const payload: Partial<Ticket> = {};

                entries.forEach(([field, value]) => {
                  if (field === "assignee" && value === "unassigned") {
                    payload.assignee = null;
                    return;
                  }

                  if (!value) {
                    if (field === "assignee") {
                      payload.assignee = null;
                    } else {
                      (payload as Record<string, unknown>)[field] = value;
                    }
                    return;
                  }

                  if (field === "assignee") {
                    const agent =
                      availableAgents.find((item) => item.id === value) ??
                      (ticket.assignee && ticket.assignee.id === value ? ticket.assignee : undefined) ??
                      (currentAgent && currentAgent.id === value ? currentAgent : undefined);
                    payload.assignee = agent ?? null;
                  } else {
                    (payload as Record<string, unknown>)[field] = value;
                  }
                });

                if (Object.keys(payload).length > 0) {
                  handleSubmit(payload);
                }
              }}
            >
              <Form.Item label="Status" name="status">
                <Select
                  options={statusOptions}
                  aria-label="Alterar status do ticket"
                  disabled={mutation.isPending}
                />
              </Form.Item>
              <Form.Item label="Categoria" name="category">
                <Select
                  options={categoryOptions}
                  aria-label="Alterar categoria do ticket"
                  disabled={mutation.isPending}
                />
              </Form.Item>
              <Form.Item label="Responsável" name="assignee">
                <Select
                  options={assigneeOptions}
                  aria-label="Alterar responsável"
                  disabled={mutation.isPending}
                />
              </Form.Item>
            </Form>
            <Button
              variant="outlined"
              onClick={() => {
                if (!currentAgent) {
                  message.info("Informe o atendente atual para atribuir.");
                  return;
                }
                if (ticket.assignee?.id === currentAgent.id) {
                  message.success("Você já está atribuído a este ticket.");
                  return;
                }
                handleSubmit({ assignee: currentAgent });
                form.setFieldsValue({ assignee: currentAgent.id });
              }}
              disabled={mutation.isPending || !currentAgent}
            >
              Atribuir a mim
            </Button>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
