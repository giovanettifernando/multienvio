"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Button,
  Tag,
  Table,
  Input,
  Select,
  Space,
  Tooltip,
  App,
  Modal,
  Descriptions,
  Image,
  Typography,
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
  "Aguardando postagem",
  "Postado",
  "Em trânsito",
  "Em rota de entrega",
  "Entregue",
  "Cancelado",
  "Devolvido",
];

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  "Aguardando coleta": "default",
  "Aguardando postagem": "default",
  Postado: "geekblue",
  "Em trânsito": "blue",
  "Em rota de entrega": "gold",
  Entregue: "green",
  Cancelado: "red",
  Devolvido: "orange",
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
        sorter: (a, b) => a.trackingCode.localeCompare(b.trackingCode),
        render: (trackingCode: string, row: Shipment) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{trackingCode}</Text>
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
                <span>Divergência registrada</span>
              </button>
            )}
          </div>
        ),
      },
      {
        title: "Destinatário",
        sorter: (a, b) => (a.recipientName || '').localeCompare(b.recipientName || ''),
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
        sorter: (a, b) => (a.carrierName || a.serviceName || '').localeCompare(b.carrierName || b.serviceName || ''),
        render: (_value, row) => row.carrierName ?? row.serviceName ?? "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        sorter: (a, b) => {
          // Ordenar por ordem de prioridade dos status
          const statusOrder: Record<ShipmentStatus, number> = {
            "Aguardando coleta": 1,
            "Aguardando postagem": 2,
            "Postado": 3,
            "Em trânsito": 4,
            "Em rota de entrega": 5,
            "Entregue": 6,
            "Cancelado": 7,
            "Devolvido": 8,
          };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        },
        render: (value: ShipmentStatus, row: Shipment) => (
          <Space direction="vertical" size={4}>
            <Tag
              color={STATUS_COLORS[value] ?? "default"}
              style={{
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 10px',
                border: 'none',
              }}
            >
              {value}
            </Tag>
            {row.pickupRequest && row.pickupRequest.status !== 'CANCELED' && row.pickupRequest.status !== 'COMPLETED' && (
              <Tag
                color={row.pickupRequest.status === 'PENDING' ? 'orange' : 'blue'}
                style={{
                  fontSize: 10,
                  borderRadius: 9999,
                  padding: '1px 8px',
                  border: 'none',
                }}
              >
                Coleta: {row.pickupRequest.status === 'PENDING' ? 'Pendente' : row.pickupRequest.status === 'SCHEDULED' ? 'Agendada' : row.pickupRequest.status}
              </Tag>
            )}
          </Space>
        ),
      },
      {
        title: "Data de criação",
        dataIndex: "createdAt",
        sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        render: (value: string) => {
          const date = new Date(value);
          return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        },
      },
      {
        title: "Data prevista de entrega",
        sorter: (a, b) => {
          const dateA = a.expectedDeliveryDate
            ? new Date(a.expectedDeliveryDate)
            : new Date(new Date(a.createdAt).getTime() + a.etaDays * 86_400_000);
          const dateB = b.expectedDeliveryDate
            ? new Date(b.expectedDeliveryDate)
            : new Date(new Date(b.createdAt).getTime() + b.etaDays * 86_400_000);
          return dateA.getTime() - dateB.getTime();
        },
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
        align: "right" as const,
        sorter: (a, b) => (a.freightValue || 0) - (b.freightValue || 0),
        render: (value: number) => {
          const formatted = Number(value ?? 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          });
          return <span style={{ fontWeight: 500 }}>{formatted}</span>;
        },
      },
      {
        title: "Ações",
        align: "center" as const,
        render: (_value, row) => (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            {/* Visualizar detalhes - Verde */}
            <Tooltip title="Ver detalhes">
              <Link href={`/shipments/${row.id}`}>
                <button
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 9999,
                    backgroundColor: '#dcfce7',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bbf7d0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; }}
                >
                  <EyeOutlined style={{ fontSize: 14, color: '#16a34a' }} />
                </button>
              </Link>
            </Tooltip>

            {/* Imprimir etiqueta - Cinza escuro */}
            <Tooltip title="Imprimir etiqueta">
              <button
                disabled={!row.labelUrl}
                onClick={() => {
                  if (row.labelUrl) handlePrintLabel(row.id, row.labelUrl);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  backgroundColor: row.labelUrl ? '#374151' : '#e5e7eb',
                  border: 'none',
                  cursor: row.labelUrl ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                  opacity: row.labelUrl ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (row.labelUrl) e.currentTarget.style.backgroundColor = '#1f2937';
                }}
                onMouseLeave={(e) => {
                  if (row.labelUrl) e.currentTarget.style.backgroundColor = '#374151';
                }}
              >
                <PrinterOutlined style={{ fontSize: 14, color: row.labelUrl ? '#fff' : '#9ca3af' }} />
              </button>
            </Tooltip>

            {/* Rastreio público - Roxo */}
            <Tooltip title="Abrir rastreio">
              <button
                disabled={!row.trackingUrl}
                onClick={() => {
                  if (row.trackingUrl) window.open(row.trackingUrl, "_blank");
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  backgroundColor: row.trackingUrl ? '#7c3aed' : '#e5e7eb',
                  border: 'none',
                  cursor: row.trackingUrl ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                  opacity: row.trackingUrl ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (row.trackingUrl) e.currentTarget.style.backgroundColor = '#6d28d9';
                }}
                onMouseLeave={(e) => {
                  if (row.trackingUrl) e.currentTarget.style.backgroundColor = '#7c3aed';
                }}
              >
                <GlobalOutlined style={{ fontSize: 14, color: row.trackingUrl ? '#fff' : '#9ca3af' }} />
              </button>
            </Tooltip>

            {/* Ver coleta - Amarelo (sempre renderizado) */}
            <Tooltip title={row.pickupRequest ? "Ver coleta" : "Coleta não disponível para este envio"}>
              {row.pickupRequest ? (
                <Link href={`/coletas?shipmentId=${row.id}`}>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 9999,
                      backgroundColor: '#fef08a',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fde047'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef08a'; }}
                  >
                    <CarOutlined style={{ fontSize: 14, color: '#854d0e' }} />
                  </button>
                </Link>
              ) : (
                <button
                  disabled
                  aria-disabled="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 9999,
                    backgroundColor: '#e5e7eb',
                    border: 'none',
                    cursor: 'not-allowed',
                    opacity: 0.5,
                  }}
                >
                  <CarOutlined style={{ fontSize: 14, color: '#9ca3af' }} />
                </button>
              )}
            </Tooltip>

            {/* Cancelar envio - Vermelho */}
            {(() => {
              // Status finais que não podem ser cancelados
              const finalStatuses: ShipmentStatus[] = ["Entregue", "Cancelado", "Devolvido"];
              const isFinalStatus = finalStatuses.includes(row.status);

              return (
                <Tooltip title={isFinalStatus ? "Não é possível cancelar" : "Cancelar envio"}>
                  <button
                    disabled={isFinalStatus || cancelMut.isPending}
                    onClick={() => cancelMut.mutate(row.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 9999,
                      backgroundColor: isFinalStatus ? '#e5e7eb' : '#dc2626',
                      border: 'none',
                      cursor: isFinalStatus ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      opacity: isFinalStatus ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isFinalStatus) {
                        e.currentTarget.style.backgroundColor = '#b91c1c';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isFinalStatus) {
                        e.currentTarget.style.backgroundColor = '#dc2626';
                      }
                    }}
                  >
                    <StopOutlined style={{ fontSize: 14, color: isFinalStatus ? '#9ca3af' : '#fff' }} />
                  </button>
                </Tooltip>
              );
            })()}
          </div>
        ),
      },
    ],
    [cancelMut, handlePrintLabel, handleOpenDivergenceModal],
  );

  return (
    <PageShell title="Gestão de envios" gap="md">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          allowClear
          style={{ flex: 1, minWidth: 280 }}
          placeholder="Buscar por ID, rastreio, nome ou data (YYYY-MM-DD)"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          style={{ width: 200 }}
          placeholder="Filtrar por status"
          value={status}
          onChange={(value) => setStatus(value as ShipmentStatus | "Todos")}
          options={STATUS_OPTIONS.map((opt) => ({
            label: opt,
            value: opt,
          }))}
        />
        <Button onClick={() => refetch()} disabled={isLoading}>
          Atualizar
        </Button>
      </div>

      <Table<Shipment>
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={columns}
        className="modern-shipments-table"
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      />

      <style jsx global>{`
        .modern-shipments-table .ant-table {
          font-size: 13px;
        }

        .modern-shipments-table .ant-table-thead > tr > th {
          background-color: #f9fafb !important;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          color: #6b7280;
          border-bottom: 2px solid #e5e7eb;
          padding: 14px 16px;
        }

        .modern-shipments-table .ant-table-tbody > tr {
          transition: background-color 0.2s;
        }

        .modern-shipments-table .ant-table-tbody > tr:hover {
          background-color: #f9fafb !important;
        }

        .modern-shipments-table .ant-table-tbody > tr > td {
          padding: 16px;
          border-bottom: 1px solid #f3f4f6;
        }

        .modern-shipments-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none;
        }
      `}</style>

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
