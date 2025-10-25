"use client";

import { Timeline, Typography, Space } from "antd";
import type { TicketEvent, SupportAttachment } from "@/types/support";

const EVENT_LABEL: Record<TicketEvent["type"], string> = {
  CREATED: "Ticket criado",
  STATUS_CHANGED: "Status alterado",
  ASSIGNED: "Atribuição",
  COMMENT: "Comentário",
  ATTACHMENT: "Anexo",
  SLA_BREACH: "SLA excedido",
  NOTE: "Nota",
};

type Props = {
  events: TicketEvent[];
  attachments?: SupportAttachment[];
};

const AUTHOR_LABEL: Record<TicketEvent["author"], string> = {
  USER: "Cliente",
  AGENT: "Atendente",
  SYSTEM: "Sistema",
};

export function TicketTimeline({ events, attachments }: Props) {
  const attachmentIndex = new Map(
    (attachments ?? []).map((attachment) => [attachment.id, attachment]),
  );

  return (
    <Timeline
      style={{ width: "100%" }}
      items={[...events]
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .map((event) => ({
          color:
            event.type === "SLA_BREACH"
              ? "red"
              : event.type === "COMMENT"
              ? "blue"
              : "gray",
          children: (
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Space size={8} style={{ width: "100%", justifyContent: "space-between" }}>
                <Typography.Text strong>{EVENT_LABEL[event.type]}</Typography.Text>
                <Typography.Text type="secondary">
                  {new Date(event.createdAt).toLocaleString("pt-BR")}
                </Typography.Text>
              </Space>
              <Typography.Paragraph style={{ margin: 0 }}>
                {event.message}
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                {AUTHOR_LABEL[event.author]}
              </Typography.Text>
              {event.attachmentIds?.length ? (
                <Space direction="vertical" size={4} aria-label="Anexos">
                  {event.attachmentIds.map((attachmentId) => {
                    const attachment = attachmentIndex.get(attachmentId);
                    if (!attachment) {
                      return null;
                    }
                    return (
                      <Space key={attachment.id} size={8}>
                        <Typography.Link href={attachment.url} target="_blank">
                          {attachment.fileName}
                        </Typography.Link>
                        <Typography.Text type="secondary">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </Typography.Text>
                      </Space>
                    );
                  })}
                </Space>
              ) : null}
            </Space>
          ),
        }))}
    />
  );
}
