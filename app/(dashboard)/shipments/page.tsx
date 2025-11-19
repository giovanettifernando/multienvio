"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Button,
  Tag,
  Table,
  Input,
  Segmented,
  Space,
  Tooltip,
  App,
  Modal,
  Descriptions,
  Image,
  Typography,
  Alert,
} from "antd";
import {
  PrinterOutlined,
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
  GlobalOutlined,
  CarOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useShipments, useShipmentCancel } from "@/hooks/useShipments";
import type { Shipment, ShipmentStatus } from "@/src/types/shipments";
import type { LabelItem } from "@/lib/types/label";
import type { ColumnsType } from "antd/es/table";
import { PageShell } from "@/components/shared/PageShell";
import { useQuery } from "@tanstack/react-query";

const { Text } = Typography;

const STATUS_OPTIONS: Array<ShipmentStatus | "Todos"> = [
  "Todos",
  "Aguardando coleta",
  "Postado",
  "Em trânsito",
  "Em rota de entrega",
  "Entregue",
  "Cancelado",
];

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  "Aguardando coleta": "default",
  Postado: "geekblue",
  "Em trânsito": "blue",
  "Em rota de entrega": "gold",
  Entregue: "green",
  Cancelado: "red",
};

type ShipmentVolumeDivergence = {
  id: string;
  volumeLabel: string;
  registeredDimensions?: {
    widthCm: number;
    heightCm: number;
    lengthCm: number;
  };
  registeredWeightKg?: number;
  type: 'DIMENSAO' | 'PESO' | 'DIMENSAO_E_PESO';
  newDimensions?: {
    widthCm: number;
    heightCm: number;
    lengthCm: number;
  };
  newWeightKg?: number;
  observations?: string;
  photoUrl?: string | null;
  createdAt: string;
  collectorName?: string;
  pickupPointName?: string;
};

export default function ShipmentsPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "Todos">("Todos");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [divergenceModalOpen, setDivergenceModalOpen] = useState(false);

  const { data, isLoading, refetch } = useShipments({ q: query, status });
  const cancelMut = useShipmentCancel();

  const items = data?.items ?? [];

  // DEBUG: Log para verificar se hasVolumeDivergence está chegando
  React.useEffect(() => {
    if (items.length > 0) {
      const itemsWithDivergence = items.filter(item => item.hasVolumeDivergence);
      console.log('[SHIPMENTS_PAGE] Total items:', items.length);
      console.log('[SHIPMENTS_PAGE] Items com divergência:', itemsWithDivergence.length);
      if (itemsWithDivergence.length > 0) {
        console.log('[SHIPMENTS_PAGE] Divergências encontradas:', itemsWithDivergence.map(i => ({
          trackingCode: i.trackingCode,
          hasVolumeDivergence: i.hasVolumeDivergence,
        })));
      }
    }
  }, [items]);

  // Query para buscar divergências quando modal abrir
  const { data: divergencesData, isLoading: divergencesLoading } = useQuery<{
    divergences: ShipmentVolumeDivergence[];
  }>({
    queryKey: ['shipment-divergences', selectedShipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${selectedShipmentId}/divergences`);
      if (!res.ok) {
        throw new Error('Erro ao buscar divergências');
      }
      return res.json();
    },
    enabled: !!selectedShipmentId && divergenceModalOpen,
  });

  const handleOpenDivergenceModal = useCallback((shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDivergenceModalOpen(true);
  }, []);

  const handleCloseDivergenceModal = useCallback(() => {
    setDivergenceModalOpen(false);
    setSelectedShipmentId(null);
  }, []);

  // Função para imprimir etiqueta e marcar como impressa
  const handlePrintLabel = useCallback(async (shipmentId: string, labelUrl: string) => {
    try {
      // Abrir etiqueta para impressão
      window.open(labelUrl, "_blank");

      // Buscar ID da label associada ao shipment
      const response = await fetch(`/api/labels?q=${shipmentId}`);
      if (response.ok) {
        const data = await response.json();
        const label = data.items?.find((item: LabelItem) => item.shipmentId === shipmentId);

        if (label) {
          // Marcar como impressa
          await fetch(`/api/labels?id=${label.id}`, {
            method: 'PATCH',
          });
          message.success('Etiqueta marcada como impressa');
          refetch();
        }
      }
    } catch (error) {
      console.error('Erro ao imprimir etiqueta:', error);
    }
  }, [message, refetch]);

  const columns: ColumnsType<Shipment> = useMemo(
    () => [
      {
        title: "Código de rastreio",
        dataIndex: "trackingCode",
        render: (trackingCode: string, row: Shipment) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text>{trackingCode}</Text>
            {row.hasVolumeDivergence && (
              <button
                type="button"
                onClick={() => handleOpenDivergenceModal(row.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 9999,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  width: 'fit-content',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
              >
                <WarningOutlined style={{ fontSize: 13, opacity: 0.9 }} />
                <span>Divergência registrada – Clique aqui</span>
              </button>
            )}
          </div>
        ),
      },
      {
        title: "Destinatário",
        render: (_value, row) => {
          const name = row.recipientName ?? "";
          const locality = row.recipientCityUf ?? "";

          if (name && locality) {
            return <span>{name} · {locality}</span>;
          }
          if (name) return <span>{name}</span>;
          if (locality) return <span>{locality}</span>;
          return <span>—</span>;
        },
      },
      {
        title: "Transportadora",
        render: (_value, row) => row.carrierName ?? row.serviceName ?? "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (value: ShipmentStatus, row: Shipment) => (
          <Space direction="vertical" size={4}>
            <Tag color={STATUS_COLORS[value] ?? "default"}>{value}</Tag>
            {row.pickupRequest && row.pickupRequest.status !== 'CANCELED' && row.pickupRequest.status !== 'COMPLETED' && (
              <Tag color={row.pickupRequest.status === 'PENDING' ? 'orange' : 'blue'} style={{ fontSize: 11 }}>
                Coleta: {row.pickupRequest.status === 'PENDING' ? 'Pendente' : row.pickupRequest.status === 'SCHEDULED' ? 'Agendada' : row.pickupRequest.status}
              </Tag>
            )}
          </Space>
        ),
      },
      {
        title: "Data prevista de entrega",
        render: (_value, row) => {
          const baseDate = row.expectedDeliveryDate
            ? new Date(row.expectedDeliveryDate)
            : new Date(new Date(row.createdAt).getTime() + row.etaDays * 86_400_000);
          return baseDate.toLocaleDateString();
        },
      },
      {
        title: "Valor do frete",
        dataIndex: "freightValue",
        render: (value: number) => `R$ ${Number(value ?? 0).toFixed(2)}`,
      },
      {
        title: "Ações",
        render: (_value, row) => (
          <Space>
            <Tooltip title="Detalhes do envio">
              <Link href={`/shipments/${row.id}`}>
                <Button size="small" icon={<EyeOutlined />} />
              </Link>
            </Tooltip>
            <Tooltip title="Imprimir etiqueta">
              <span>
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  disabled={!row.labelUrl}
                  onClick={() => {
                    if (row.labelUrl) handlePrintLabel(row.id, row.labelUrl);
                  }}
                />
              </span>
            </Tooltip>
            <Tooltip title="Rastrear entrega">
              <span>
                <Button
                  size="small"
                  icon={<GlobalOutlined />}
                  disabled={!row.trackingUrl}
                  onClick={() => {
                    if (row.trackingUrl) window.open(row.trackingUrl, "_blank");
                  }}
                />
              </span>
            </Tooltip>
            {row.pickupRequest && (
              <Tooltip title="Ver coleta">
                <Link href={`/coletas?shipmentId=${row.id}`}>
                  <Button size="small" icon={<CarOutlined />} />
                </Link>
              </Tooltip>
            )}
            <Tooltip title="Cancelar envio">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                disabled={row.status === "Cancelado" || row.status === "Entregue"}
                loading={cancelMut.isPending}
                onClick={() => cancelMut.mutate(row.id)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [cancelMut, handlePrintLabel, handleOpenDivergenceModal],
  );

  return (
    <PageShell title="Gestão de envios" gap="md">
      <Space wrap>
        <Input
          allowClear
          style={{ width: 320 }}
          placeholder="Buscar por ID, rastreio, nome ou data (YYYY-MM-DD)"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Segmented
          size="middle"
          value={status}
          onChange={(value) => setStatus(value as ShipmentStatus | "Todos")}
          options={STATUS_OPTIONS}
        />
        <Button onClick={() => refetch()} disabled={isLoading}>
          Atualizar
        </Button>
      </Space>

      <Table<Shipment>
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={columns}
      />

      {/* Modal de Divergências */}
      <Modal
        title="Divergências de Volumes"
        open={divergenceModalOpen}
        onCancel={handleCloseDivergenceModal}
        footer={[
          <Button key="close" onClick={handleCloseDivergenceModal}>
            Fechar
          </Button>,
        ]}
        width={800}
      >
        {divergencesLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>Carregando...</div>
        ) : divergencesData?.divergences && divergencesData.divergences.length > 0 ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {divergencesData.divergences.map((divergence) => (
              <div key={divergence.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
                <Text strong style={{ fontSize: 16, marginBottom: 12, display: 'block' }}>
                  Volume {divergence.volumeLabel}
                </Text>
                <Tag color="red" style={{ marginBottom: 12 }}>
                  {divergence.type === 'DIMENSAO' && 'Divergência de Dimensão'}
                  {divergence.type === 'PESO' && 'Divergência de Peso'}
                  {divergence.type === 'DIMENSAO_E_PESO' && 'Divergência de Dimensão e Peso'}
                </Tag>

                <Descriptions column={2} size="small" bordered>
                  {divergence.registeredDimensions && (
                    <>
                      <Descriptions.Item label="Dimensões declaradas" span={2}>
                        {divergence.registeredDimensions.widthCm} × {divergence.registeredDimensions.heightCm} × {divergence.registeredDimensions.lengthCm} cm
                      </Descriptions.Item>
                      {divergence.newDimensions && (
                        <Descriptions.Item label="Dimensões registradas" span={2}>
                          <Text type="danger" strong>
                            {divergence.newDimensions.widthCm} × {divergence.newDimensions.heightCm} × {divergence.newDimensions.lengthCm} cm
                          </Text>
                        </Descriptions.Item>
                      )}
                    </>
                  )}

                  {divergence.registeredWeightKg !== undefined && (
                    <>
                      <Descriptions.Item label="Peso declarado">
                        {divergence.registeredWeightKg} kg
                      </Descriptions.Item>
                      {divergence.newWeightKg !== undefined && (
                        <Descriptions.Item label="Peso registrado">
                          <Text type="danger" strong>
                            {divergence.newWeightKg} kg
                          </Text>
                        </Descriptions.Item>
                      )}
                    </>
                  )}

                  {divergence.observations && (
                    <Descriptions.Item label="Observações" span={2}>
                      {divergence.observations}
                    </Descriptions.Item>
                  )}

                  {divergence.collectorName && (
                    <Descriptions.Item label="Registrado por">
                      {divergence.collectorName}
                    </Descriptions.Item>
                  )}

                  <Descriptions.Item label="Data/hora">
                    {new Date(divergence.createdAt).toLocaleString('pt-BR')}
                  </Descriptions.Item>
                </Descriptions>

                {divergence.photoUrl && (
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      Foto da divergência:
                    </Text>
                    <Image
                      src={divergence.photoUrl}
                      alt="Foto da divergência"
                      style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Text type="secondary">Nenhuma divergência encontrada</Text>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
