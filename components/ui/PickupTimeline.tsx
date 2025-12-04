"use client";

import { Timeline, Typography } from "antd";

/**
 * Estrutura de uma tentativa de coleta armazenada no campo attemptNotes do banco
 */
export type PickupAttempt = {
  date: string; // ISO date string
  note: string;
  operator?: string;
  success?: boolean;
};

type Props = {
  attempts: PickupAttempt[];
  createdAt: string;
  status: string;
};

/**
 * Timeline de eventos da coleta baseada nos dados reais do banco
 */
export function PickupTimeline({ attempts, createdAt, status }: Props) {
  // Build events from attempts + creation + current status
  const items = [];

  // Created event
  items.push({
    color: "blue",
    content: (
      <div>
        <Typography.Text strong>Coleta solicitada</Typography.Text>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          {new Date(createdAt).toLocaleString("pt-BR")}
        </Typography.Paragraph>
      </div>
    ),
  });

  // Attempt events
  for (const attempt of attempts) {
    items.push({
      color: attempt.success ? "green" : "orange",
      content: (
        <div>
          <Typography.Text strong>
            {attempt.success ? "Coleta realizada" : "Tentativa de coleta"}
          </Typography.Text>
          <Typography.Paragraph style={{ margin: 0 }}>
            {attempt.note}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ margin: 0 }} type="secondary">
            {new Date(attempt.date).toLocaleString("pt-BR")}
            {attempt.operator ? ` · ${attempt.operator}` : ""}
          </Typography.Paragraph>
        </div>
      ),
    });
  }

  // Final status if completed/failed/canceled
  if (status === "COMPLETED") {
    items.push({
      color: "green",
      content: (
        <div>
          <Typography.Text strong>Coleta concluída</Typography.Text>
        </div>
      ),
    });
  } else if (status === "FAILED") {
    items.push({
      color: "red",
      content: (
        <div>
          <Typography.Text strong>Coleta falhou</Typography.Text>
        </div>
      ),
    });
  } else if (status === "CANCELED") {
    items.push({
      color: "gray",
      content: (
        <div>
          <Typography.Text strong>Coleta cancelada</Typography.Text>
        </div>
      ),
    });
  }

  return <Timeline items={items} />;
}
