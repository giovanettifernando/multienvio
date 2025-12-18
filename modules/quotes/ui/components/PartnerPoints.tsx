"use client";

import { EnvironmentOutlined } from "@ant-design/icons";
import { Alert, Card, Typography, Flex, Divider } from "antd";
import type { PartnerPoint } from '@/shared/types/quote';

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
      <Flex vertical gap={0}>
        {points.map((item, index) => (
          <div key={item.id}>
            {index > 0 && <Divider style={{ margin: '12px 0' }} />}
            <Flex gap={12} align="flex-start">
              <EnvironmentOutlined style={{ fontSize: 16, color: '#8c8c8c', marginTop: 4 }} />
              <Flex vertical>
                <Typography.Text strong>{item.nome}</Typography.Text>
                <Typography.Text>
                  {item.enderecoCurto ?? "Endereço indisponível"}
                </Typography.Text>
                <Typography.Text type="secondary">
                  A {item.distanciaKm.toFixed(1)} km de distância
                </Typography.Text>
              </Flex>
            </Flex>
          </div>
        ))}
      </Flex>
    </Card>
  );
}
