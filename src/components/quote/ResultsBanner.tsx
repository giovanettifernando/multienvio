"use client";

import { useState } from "react";
import {
  CalendarOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  InboxOutlined,
  TagOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Flex,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import type { QuoteSummary, QuoteVolume } from "@/types/quote";

type ResultsBannerProps = {
  summary: QuoteSummary;
  onEditVolumes: () => void;
  onEditReminder: () => void;
  onRemoveReminder: () => void;
};

const formatVolume = (volume: QuoteVolume, index: number) => {
  const dims = `${volume.comprimentoCm} × ${volume.larguraCm} × ${volume.alturaCm} cm`;
  const weight = `${volume.pesoKg.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
  return `Volume ${index + 1} — ${dims} · ${weight}`;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function ResultsBanner({
  summary,
  onEditVolumes,
  onEditReminder,
  onRemoveReminder,
}: ResultsBannerProps) {
  const [volumesModalOpen, setVolumesModalOpen] = useState(false);

  const volumes = summary.volumes ?? [];
  const firstVolume = volumes[0];
  const remainingCount = volumes.length > 1 ? volumes.length - 1 : 0;

  return (
    <>
      <Card
        style={{
          background: "#f0f5ff",
          borderColor: "#d6e4ff",
        }}
        styles={{ body: { padding: 24 } }}
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Space direction="vertical" size={8}>
              <Typography.Text type="secondary">De</Typography.Text>
              <Space align="start" size={12}>
                <HomeOutlined />
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {summary.origemCep}
                  </Typography.Title>
                  {summary.origemCidade && summary.origemUf ? (
                    <Typography.Text type="secondary">
                      {summary.origemCidade} / {summary.origemUf}
                    </Typography.Text>
                  ) : null}
                  {summary.origemIsDefault ? (
                    <div>
                      <Tag icon={<TagOutlined />} color="blue">
                        Meu endereço
                      </Tag>
                    </div>
                  ) : null}
                </div>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Space direction="vertical" size={8}>
              <Typography.Text type="secondary">Para</Typography.Text>
              <Space align="start" size={12}>
                <EnvironmentOutlined />
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {summary.destinoCep}
                  </Typography.Title>
                  {summary.destinoCidade && summary.destinoUf ? (
                    <Typography.Text type="secondary">
                      {summary.destinoCidade} / {summary.destinoUf}
                    </Typography.Text>
                  ) : null}
                </div>
              </Space>
            </Space>
          </Col>
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Typography.Text type="secondary">
                Valor do seguro da carga
              </Typography.Text>
              <Space align="center" size={12}>
                <CalendarOutlined />
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {formatCurrency(summary.seguroValor ?? null)}
                </Typography.Title>
              </Space>
            </Space>
          </Col>
        </Row>

        <DividerSection />

        <Flex align="center" justify="space-between" gap={12} wrap>
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">Volumes</Typography.Text>
            {firstVolume ? (
              <Typography.Text>
                {formatVolume(firstVolume, 0)}
              </Typography.Text>
            ) : (
              <Typography.Text>Sem volumes informados</Typography.Text>
            )}
            {remainingCount > 0 ? (
              <Button type="link" onClick={() => setVolumesModalOpen(true)} size="small">
                Ver mais volumes (+{remainingCount})
              </Button>
            ) : null}
            <Space size={8}>
              {summary.coleta ? <Tag color="blue">Com coleta</Tag> : null}
              {summary.devolucao ? <Tag color="purple">Logística reversa</Tag> : null}
            </Space>
          </Space>
          <Button icon={<InboxOutlined />} onClick={onEditVolumes}>
            Editar volumes
          </Button>
        </Flex>

        <DividerSection />

        <Flex align="center" gap={12} wrap>
          <Typography.Text strong>Lembrete</Typography.Text>
          {summary.lembrete ? (
            <Space size={8}>
              <Tag color="geekblue">{summary.lembrete}</Tag>
              <Button type="link" onClick={onEditReminder}>
                Editar
              </Button>
              <Button type="link" danger onClick={onRemoveReminder}>
                Remover
              </Button>
            </Space>
          ) : (
            <Button type="link" onClick={onEditReminder}>
              Adicionar lembrete
            </Button>
          )}
        </Flex>
      </Card>

      <Modal
        title="Volumes da cotação"
        open={volumesModalOpen}
        onCancel={() => setVolumesModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {volumes.map((volume, index) => (
            <Card key={volume.id} size="small">
              <Typography.Text>{formatVolume(volume, index)}</Typography.Text>
            </Card>
          ))}
        </Space>
      </Modal>
    </>
  );
}

function DividerSection() {
  return <div style={{ height: 1, backgroundColor: "#d6e4ff", margin: "24px 0" }} />;
}
