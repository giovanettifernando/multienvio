"use client";

import { EnvironmentOutlined } from "@ant-design/icons";
import { Alert, Card, List, Typography } from "antd";
import type { PartnerPoint } from "@/types/quote";

type PartnerPointsProps = {
  points?: PartnerPoint[];
};

export function PartnerPoints({ points }: PartnerPointsProps) {
  if (!points || points.length === 0) {
    return null;
  }

  return (
    <Card title="Pontos parceiros sugeridos">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Ao optar por Ponto Parceiro, +1 dia útil no prazo."
      />
      <List
        dataSource={points}
        renderItem={(item) => (
          <List.Item key={item.id}>
            <List.Item.Meta
              avatar={<EnvironmentOutlined />}
              title={<Typography.Text strong>{item.nome}</Typography.Text>}
              description={
                <>
                  <Typography.Text>
                    {item.enderecoCurto ?? "Endereço indisponível"}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    A {item.distanciaKm.toFixed(1)} km de distância
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
