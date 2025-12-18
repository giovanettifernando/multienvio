"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Tooltip,
  App,
  Descriptions,
  Image,
  Typography,
} from "antd";
import { ELCard } from '@/shared/ui/ELCard';
import {
  PrinterOutlined,
  StopOutlined,
  GlobalOutlined,
  CarOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useShipments, useShipmentCancel } from "@/hooks/useShipments";
import type { Shipment, ShipmentStatus } from '@/shared/types/shipments';
import { PageShell } from '@/shared/ui/PageShell';
import { useQuery } from "@tanstack/react-query";
import { ELButton } from '@/shared/ui/ELButton';
import { ELInput } from '@/shared/ui/ELInput';
import { ELSelect } from '@/shared/ui/ELSelect';
import { ELStatusTag, type StatusVariant } from '@/shared/ui/ELStatusTag';
import { ELModal } from '@/shared/ui/ELModal';
import { ELTag } from '@/shared/ui/ELTag';
import { ELSkeleton } from '@/shared/ui/ELSkeleton';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { ActionBar } from '@/shared/ui/ActionBar';
import tableStyles from "@/shared/ui/ELTableWrapper.module.css";
import { ShipmentLabelPdfModal } from "@/modules/labels/ui/components";

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
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedShipmentForLabel, setSelectedShipmentForLabel] = useState<Shipment | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [shipmentToCancel, setShipmentToCancel] = useState<Shipment | null>(null);

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

  // Buscar dados completos do shipment para o modal de etiqueta
  const { data: shipmentDetailForLabel } = useQuery<{
    label: { id: string; status: string } | null;
    volumes: Array<{ id: string; packageNumber: number; weight: number }>;
  }>({
    queryKey: ['shipment-label-detail', selectedShipmentForLabel?.id],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${selectedShipmentForLabel?.id}`);
      if (!res.ok) {
        throw new Error('Erro ao buscar dados do envio');
      }
      const json = await res.json();
      const data = json.data ?? json;
      return {
        label: data.label,
        volumes: data.volumes?.map((v: { id: string; packageNumber: number; weight: number }) => ({
          id: v.id,
          packageNumber: v.packageNumber,
          weight: v.weight,
        })) || [],
      };
    },
    enabled: !!selectedShipmentForLabel?.id && labelModalOpen,
  });

  const handleOpenDivergenceModal = useCallback((shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDivergenceModalOpen(true);
  }, []);

  const handleCloseDivergenceModal = useCallback(() => {
    setDivergenceModalOpen(false);
    setSelectedShipmentId(null);
  }, []);

  const handleOpenLabelModal = useCallback((shipment: Shipment) => {
    setSelectedShipmentForLabel(shipment);
    setLabelModalOpen(true);
  }, []);

  const handleCloseLabelModal = useCallback(() => {
    setLabelModalOpen(false);
    setSelectedShipmentForLabel(null);
  }, []);

  // Handlers para confirmação de cancelamento
  const handleOpenCancelConfirm = useCallback((shipment: Shipment) => {
    setShipmentToCancel(shipment);
    setCancelConfirmOpen(true);
  }, []);

  const handleCloseCancelConfirm = useCallback(() => {
    setCancelConfirmOpen(false);
    setShipmentToCancel(null);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!shipmentToCancel) return;

    try {
      await cancelMut.mutateAsync(shipmentToCancel.id);
      message.success('Envio cancelado com sucesso');
    } catch {
      message.error('Erro ao cancelar envio');
    } finally {
      handleCloseCancelConfirm();
    }
  }, [shipmentToCancel, cancelMut, message, handleCloseCancelConfirm]);

  // Função auxiliar para formatar datas
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Função auxiliar para calcular data prevista
  const getExpectedDate = (row: Shipment) => {
    const baseDate = row.expectedDeliveryDate
      ? new Date(row.expectedDeliveryDate)
      : new Date(new Date(row.createdAt).getTime() + row.etaDays * 86_400_000);
    return baseDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const columns: DataTableColumn<Shipment>[] = useMemo(
    () => [
      // COLUNA 1: Envio (código + destinatário + cidade/UF)
      {
        title: "Envio",
        key: "shipment",
        showInCard: true,
        cardLabel: "Envio",
        sorter: (a, b) => a.trackingCode.localeCompare(b.trackingCode),
        render: (_value, row: Shipment) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.4 }}>
            <Link href={`/shipments/${row.id}`} style={{ color: 'var(--el-color-primary)', fontWeight: 700, fontSize: 15 }}>
              {row.trackingCode}
            </Link>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {row.recipientName || '—'}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.recipientCityUf || '—'}
            </Text>
            {row.hasVolumeDivergence && (
              <ELButton
                variant="danger"
                size="small"
                icon={<WarningOutlined />}
                onClick={() => handleOpenDivergenceModal(row.id)}
                style={{ width: 'fit-content', marginTop: 2 }}
              >
                Divergência
              </ELButton>
            )}
          </div>
        ),
      },
      // COLUNA 2: Status & Datas (status protagonista + datas neutras)
      {
        title: "Status & Datas",
        key: "statusDates",
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.4, alignItems: 'center' }}>
            <ELStatusTag variant={STATUS_VARIANTS[row.status] ?? "default"} size="default">
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
            <Text type="secondary" style={{ fontSize: 11 }}>
              Criado: {formatDate(row.createdAt)}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Previsto: {formatDate(row.expectedDeliveryDate || new Date(new Date(row.createdAt).getTime() + row.etaDays * 86_400_000).toISOString())}
            </Text>
          </div>
        ),
      },
      // COLUNA 3: Frete (transportadora em tag + valor)
      {
        title: "Frete",
        key: "freight",
        showInCard: true,
        cardLabel: "Frete",
        sorter: (a, b) => (a.freightValue || 0) - (b.freightValue || 0),
        render: (_value, row: Shipment) => {
          const formatted = Number(row.freightValue ?? 0).toLocaleString('pt-BR', {
            style: 'currency', currency: 'BRL',
          });
          const carrierName = row.carrierName ?? row.serviceName ?? '—';
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.4, alignItems: 'center' }}>
              <ELStatusTag variant="processing" size="default">
                {carrierName}
              </ELStatusTag>
              <Text strong style={{ fontSize: 15, color: 'var(--el-color-primary)' }}>
                {formatted}
              </Text>
            </div>
          );
        },
      },
      // COLUNA 4: Ações (sem botão de ver detalhes, cancelar compacto)
      {
        title: "Ações",
        key: "actions",
        isActions: true,
        width: 120,
        render: (_value, row) => {
          const finalStatuses: ShipmentStatus[] = ["Entregue", "Cancelado", "Devolvido"];
          const isFinalStatus = finalStatuses.includes(row.status);

          // Envios cancelados não mostram nenhuma ação
          if (row.status === "Cancelado") {
            return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
          }

          return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Tooltip title="Imprimir etiqueta">
                <ELButton
                  variant="ghost"
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => handleOpenLabelModal(row)}
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
              {!isFinalStatus && (
                <Tooltip title="Cancelar envio">
                  <ELButton
                    variant="ghost"
                    size="small"
                    icon={<StopOutlined style={{ color: 'var(--el-color-danger)' }} />}
                    disabled={cancelMut.isPending}
                    onClick={() => handleOpenCancelConfirm(row)}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [cancelMut, handleOpenLabelModal, handleOpenDivergenceModal, handleOpenCancelConfirm],
  );

  return (
    <PageShell title="Meus Envios" gap="md">
      <div className={tableStyles.wrapper}>
        <ELCard>
          <ActionBar
            extraActions={[
              {
                key: "refresh",
                label: "Atualizar",
                onClick: () => refetch(),
                disabled: isLoading,
              },
            ]}
          >
            <ELInput.Search
              allowClear
              placeholder="Buscar por rastreio, destinatário, cidade ou transportadora"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onSearch={(value) => handleQueryChange(value)}
            />
            <ELSelect
              style={{ minWidth: 180 }}
              placeholder="Filtrar por status"
              value={status}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
            />
          </ActionBar>

          <DataTable<Shipment>
            rowKey="id"
            loading={isLoading}
            data={items}
            columns={columns}
            enableMobileCards
            scrollX={700}
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
        </ELCard>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
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
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Text type="secondary">Nenhuma divergência encontrada</Text>
          </div>
        )}
      </ELModal>

      {/* Modal de impressão de etiqueta */}
      {selectedShipmentForLabel && (
        <ShipmentLabelPdfModal
          open={labelModalOpen}
          onClose={handleCloseLabelModal}
          shipmentId={selectedShipmentForLabel.id}
          trackingCode={selectedShipmentForLabel.trackingCode}
          volumes={shipmentDetailForLabel?.volumes || []}
          labelId={shipmentDetailForLabel?.label?.id}
        />
      )}

      {/* Modal de confirmação de cancelamento */}
      <ELModal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: 'var(--el-color-danger)', fontSize: 20 }} />
            <span>Confirmar Cancelamento</span>
          </div>
        }
        open={cancelConfirmOpen}
        onCancel={handleCloseCancelConfirm}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ELButton onClick={handleCloseCancelConfirm}>
              Voltar
            </ELButton>
            <ELButton
              variant="danger"
              onClick={handleConfirmCancel}
              loading={cancelMut.isPending}
            >
              Confirmar Cancelamento
            </ELButton>
          </div>
        }
        size="sm"
      >
        <div style={{ padding: '8px 0' }}>
          <Text>
            Tem certeza que deseja cancelar o envio{' '}
            <Text strong style={{ color: 'var(--el-color-primary)' }}>
              {shipmentToCancel?.trackingCode}
            </Text>
            ?
          </Text>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Esta acao nao pode ser desfeita. O valor do frete sera estornado para sua carteira.
            </Text>
          </div>
        </div>
      </ELModal>
    </PageShell>
  );
}
