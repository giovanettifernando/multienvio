"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Card,
  Space,
  Tooltip,
  App,
  Descriptions,
  Image,
  Typography,
} from "antd";
import {
  PrinterOutlined,
  EyeOutlined,
  StopOutlined,
  GlobalOutlined,
  CarOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useShipments, useShipmentCancel } from "@/hooks/useShipments";
import type { Shipment, ShipmentStatus } from "@/types/shipments";
import type { LabelItem } from "@/lib/types/label";
import { PageShell } from "@/components/shared/PageShell";
import { useQuery } from "@tanstack/react-query";
import { ELButton } from "@/components/ui/ELButton";
import { ELInput } from "@/components/ui/ELInput";
import { ELSelect } from "@/components/ui/ELSelect";
import { ELStatusTag, type StatusVariant } from "@/components/ui/ELStatusTag";
import { ELModal } from "@/components/ui/ELModal";
import { ELTag } from "@/components/ui/ELTag";
import { ELSkeleton } from "@/components/ui/ELSkeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import tableStyles from "@/components/ui/ELTableWrapper.module.css";

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

const STATUS_VARIANTS: Record<ShipmentStatus, StatusVariant> = {
  "Aguardando coleta": "default",
  "Aguardando postagem": "default",
  Postado: "processing",
  "Em trânsito": "processing",
  "Em rota de entrega": "warning",
  Entregue: "success",
  Cancelado: "danger",
  Devolvido: "warning",
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

export default function ShipmentsClient() {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "Todos">("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [divergenceModalOpen, setDivergenceModalOpen] = useState(false);

  const { data, isLoading, refetch } = useShipments({ q: query, status, page, limit: pageSize });
  const cancelMut = useShipmentCancel();

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((newStatus: ShipmentStatus | "Todos") => {
    setStatus(newStatus);
    setPage(1);
  }, []);

  const handlePaginationChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage);
    if (newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setPage(1);
    }
  }, [pageSize]);

  const { data: divergencesData, isLoading: divergencesLoading } = useQuery<{
    divergences: ShipmentVolumeDivergence[];
  }>({
    queryKey: ['shipment-divergences', selectedShipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${selectedShipmentId}/divergences`);
      if (!res.ok) {
        throw new Error('Erro ao buscar divergências');
      }
      const json = await res.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as { divergences: ShipmentVolumeDivergence[] };
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

  const handlePrintLabel = useCallback(async (shipmentId: string, labelUrl: string) => {
    try {
      window.open(labelUrl, "_blank");
      const response = await fetch(`/api/labels?q=${shipmentId}`);
      if (response.ok) {
        const data = await response.json();
        const label = data.items?.find((item: LabelItem) => item.shipmentId === shipmentId);
        if (label) {
          await fetch(`/api/labels?id=${label.id}`, { method: 'PATCH' });
          message.success('Etiqueta marcada como impressa');
          refetch();
        }
      }
    } catch (error) {
      console.error('Erro ao imprimir etiqueta:', error);
    }
  }, [message, refetch]);

  const columns: DataTableColumn<Shipment>[] = useMemo(
    () => [
      {
        title: "Código de rastreio",
        dataIndex: "trackingCode",
        key: "trackingCode",
        showInCard: true,
        cardLabel: "Rastreio",
        sorter: (a, b) => a.trackingCode.localeCompare(b.trackingCode),
        render: (_value, row: Shipment) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{row.trackingCode}</Text>
            {row.hasVolumeDivergence && (
              <ELButton
                variant="danger"
                size="small"
                icon={<WarningOutlined />}
                onClick={() => handleOpenDivergenceModal(row.id)}
                style={{ width: 'fit-content' }}
              >
                Divergência registrada
              </ELButton>
            )}
          </div>
        ),
      },
      {
        title: "Destinatário",
        key: "recipient",
        showInCard: true,
        cardLabel: "Destinatário",
        sorter: (a, b) => (a.recipientName || '').localeCompare(b.recipientName || ''),
        render: (_value, row) => {
          const name = row.recipientName ?? "";
          const locality = row.recipientCityUf ?? "";
          if (name && locality) return <span>{name} · {locality}</span>;
          if (name) return <span>{name}</span>;
          if (locality) return <span>{locality}</span>;
          return <span>—</span>;
        },
      },
      {
        title: "Transportadora",
        key: "carrier",
        showInCard: true,
        cardLabel: "Transportadora",
        sorter: (a, b) => (a.carrierName || a.serviceName || '').localeCompare(b.carrierName || b.serviceName || ''),
        render: (_value, row) => row.carrierName ?? row.serviceName ?? "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        showInCard: true,
        cardLabel: "Status",
        sorter: (a, b) => {
          const statusOrder: Record<ShipmentStatus, number> = {
            "Aguardando coleta": 1, "Aguardando postagem": 2, "Postado": 3,
            "Em trânsito": 4, "Em rota de entrega": 5, "Entregue": 6,
            "Cancelado": 7, "Devolvido": 8,
          };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        },
        render: (_value, row: Shipment) => (
          <Space orientation="vertical" size={4}>
            <ELStatusTag variant={STATUS_VARIANTS[row.status] ?? "default"}>
              {row.status}
            </ELStatusTag>
            {row.pickupRequest && row.pickupRequest.status !== 'CANCELED' && row.pickupRequest.status !== 'COMPLETED' && (
              <ELStatusTag
                variant={row.pickupRequest.status === 'PENDING' ? 'warning' : 'processing'}
                size="small"
              >
                Coleta: {row.pickupRequest.status === 'PENDING' ? 'Pendente' : row.pickupRequest.status === 'SCHEDULED' ? 'Agendada' : row.pickupRequest.status}
              </ELStatusTag>
            )}
          </Space>
        ),
      },
      {
        title: "Data de criação",
        dataIndex: "createdAt",
        key: "createdAt",
        showInCard: true,
        cardLabel: "Criado em",
        sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        render: (value) => {
          const date = new Date(value as string);
          return date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
        },
      },
      {
        title: "Data prevista",
        key: "expectedDelivery",
        showInCard: false,
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
        key: "freightValue",
        showInCard: true,
        cardLabel: "Frete",
        sorter: (a, b) => (a.freightValue || 0) - (b.freightValue || 0),
        render: (value) => {
          const formatted = Number(value ?? 0).toLocaleString('pt-BR', {
            style: 'currency', currency: 'BRL',
          });
          return <span style={{ fontWeight: 500 }}>{formatted}</span>;
        },
      },
      {
        title: "Ações",
        key: "actions",
        isActions: true,
        render: (_value, row) => {
          const finalStatuses: ShipmentStatus[] = ["Entregue", "Cancelado", "Devolvido"];
          const isFinalStatus = finalStatuses.includes(row.status);

          return (
            <Space size={4}>
              <Tooltip title="Ver detalhes">
                <Link href={`/shipments/${row.id}`}>
                  <ELButton variant="ghost" size="small" icon={<EyeOutlined />} />
                </Link>
              </Tooltip>

              <Tooltip title="Imprimir etiqueta">
                <ELButton
                  variant="ghost"
                  size="small"
                  icon={<PrinterOutlined />}
                  disabled={!row.labelUrl}
                  onClick={() => row.labelUrl && handlePrintLabel(row.id, row.labelUrl)}
                />
              </Tooltip>

              <Tooltip title="Abrir rastreio">
                <ELButton
                  variant="ghost"
                  size="small"
                  icon={<GlobalOutlined />}
                  disabled={!row.trackingUrl}
                  onClick={() => row.trackingUrl && window.open(row.trackingUrl, "_blank")}
                />
              </Tooltip>

              <Tooltip title={row.pickupRequest ? "Ver coleta" : "Coleta não disponível"}>
                {row.pickupRequest ? (
                  <Link href={`/coletas?shipmentId=${row.id}`}>
                    <ELButton variant="ghost" size="small" icon={<CarOutlined />} />
                  </Link>
                ) : (
                  <ELButton variant="ghost" size="small" icon={<CarOutlined />} disabled />
                )}
              </Tooltip>

              <Tooltip title={isFinalStatus ? "Não é possível cancelar" : "Cancelar envio"}>
                <ELButton
                  variant="danger"
                  size="small"
                  icon={<StopOutlined />}
                  disabled={isFinalStatus || cancelMut.isPending}
                  onClick={() => cancelMut.mutate(row.id)}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [cancelMut, handlePrintLabel, handleOpenDivergenceModal],
  );

  return (
    <PageShell title="Gestão de envios" gap="md">
      <div className={tableStyles.wrapper}>
        <Card>
          <div className={tableStyles.filterBar}>
            <ELInput.Search
              allowClear
              className={tableStyles.searchInput}
              placeholder="Buscar por rastreio, destinatário, cidade ou transportadora"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onSearch={(value) => handleQueryChange(value)}
            />
            <ELSelect
              style={{ minWidth: 160 }}
              placeholder="Filtrar por status"
              value={status}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
            />
            <ELButton onClick={() => refetch()} disabled={isLoading}>
              Atualizar
            </ELButton>
          </div>

          <DataTable<Shipment>
            rowKey="id"
            loading={isLoading}
            data={items}
            columns={columns}
            enableMobileCards
            scrollX={1200}
            emptyMessage="Nenhum envio encontrado"
            emptyDescription="Tente ajustar os filtros de busca"
            pagination={{
              current: page,
              pageSize: pageSize,
              total: pagination?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} envios`,
              onChange: handlePaginationChange,
            }}
          />
        </Card>
      </div>

      <ELModal
        title="Divergências de Volumes"
        open={divergenceModalOpen}
        onCancel={handleCloseDivergenceModal}
        footer={
          <ELButton onClick={handleCloseDivergenceModal}>
            Fechar
          </ELButton>
        }
        width={800}
      >
        {divergencesLoading ? (
          <ELSkeleton active paragraph={{ rows: 4 }} />
        ) : divergencesData?.divergences && divergencesData.divergences.length > 0 ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {divergencesData.divergences.map((divergence) => (
              <div key={divergence.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
                <Text strong style={{ fontSize: 16, marginBottom: 12, display: 'block' }}>
                  Volume {divergence.volumeLabel}
                </Text>
                <ELTag color="red" style={{ marginBottom: 12 }}>
                  {divergence.type === 'DIMENSAO' && 'Divergência de Dimensão'}
                  {divergence.type === 'PESO' && 'Divergência de Peso'}
                  {divergence.type === 'DIMENSAO_E_PESO' && 'Divergência de Dimensão e Peso'}
                </ELTag>

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
                          <Text type="danger" strong>{divergence.newWeightKg} kg</Text>
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
      </ELModal>
    </PageShell>
  );
}
