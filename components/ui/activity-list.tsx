"use client";

import { Card, List, Space, Tag, Typography } from "antd";
import type { DashboardActivity } from "@/types/dashboard";

type Props = {
  atividades?: DashboardActivity[];
  carregando?: boolean;
};

const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const TAGS: Record<DashboardActivity["tipo"], { color: string; label: string }> = {
  etiqueta: { color: "blue", label: "Etiqueta" },
  entrega: { color: "green", label: "Entrega" },
  coleta: { color: "orange", label: "Coleta" },
  alerta: { color: "red", label: "Alerta" },
};

export function ActivityList({ atividades = [], carregando }: Props) {
  return (
    <Card title="Atividades recentes" loading={carregando} variant="borderless">
      <List
        dataSource={atividades}
        locale={{ emptyText: "Nenhuma atividade registrada nos últimos dias." }}
        renderItem={(item) => {
          const tagConfig = TAGS[item.tipo];

          return (
            <List.Item key={item.id}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space align="center" size="middle">
                  <Tag color={tagConfig.color}>{tagConfig.label}</Tag>
                  <Typography.Text>{item.descricao}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">
                  {formatter.format(new Date(item.data))}
                </Typography.Text>
              </Space>
            </List.Item>
          );
        }}
      />
    </Card>
  );
}
