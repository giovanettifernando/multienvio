"use client";

import { Card, Space, Typography } from "antd";

type VolumesTotalizerProps = {
  volumeCount: number;
  totalPesoCubadoKg: number;
};

const formatKg = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function VolumesTotalizer({ volumeCount, totalPesoCubadoKg }: VolumesTotalizerProps) {
  return (
    <Card size="small" style={{ background: "#fafafa" }}>
      <Space split="•" size={16}>
        <Typography.Text>
          <strong>Volumes:</strong> {volumeCount}
        </Typography.Text>
        <Typography.Text>
          <strong>Peso cubado total:</strong> {formatKg(totalPesoCubadoKg)} kg
        </Typography.Text>
      </Space>
    </Card>
  );
}
