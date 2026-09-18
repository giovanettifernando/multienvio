"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ELDescriptions, ELTypography, useELApp, ELTooltip, ELImage } from '@/shared/ui';
const Tooltip = ELTooltip;
const Image = ELImage;
const Descriptions = ELDescriptions;
const Typography = ELTypography;
const App = { useApp: useELApp };
import { ELCard } from '@/shared/ui/ELCard';
import {
  PrinterOutlined,
  FileTextOutlined,
  StopOutlined,
  GlobalOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { fetchAndPrintShipmentDocument } from "@/modules/labels/infra/print-shipment-declaration";
import { useShipments, useShipmentCancel } from "@/modules/shipments/ui/hooks";
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
import { formatDateBR } from '@/shared/utils/date';

const { Text } = Typography;

const STATUS_OPTIONS: Array<ShipmentStatus | "Todos"> = [
  "Todos",
  "Aguardando postagem",
  "Postado",
  "Em trânsito",
  "Em rota de entrega",
  "Problema na entrega",
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
  "Problema na entrega": "danger",
  Entregue: "success",
  Cancelado: "danger",
  Devolvido: "warning",
};


export default function ShipmentsClient() {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "Todos">("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [selectedShipmentForLabel, setSelectedShipmentForLabel] = useState<Shipment | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [shipmentToCancel, setShipmentToCancel] = useState<Shipment | null>(null);
  // Id do envio cuja declaração está sendo montada — a listagem não traz os
  // volumes, então é preciso buscar o detalhe antes de gerar o PDF.
  const [printingDocumentId, setPrintingDocumentId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useShipments({ q: query, status, page, limit: pageSize });
  const cancelMut = useShipmentCancel();

  // Sync tracking em background ao montar o componente
  const syncTriggeredRef = useRef(false);
  useEffect(() => {
    if (syncTriggeredRef.current) return;
    syncTriggeredRef.current = true;

    // Dispara sync em background (fire and forget)
    fetch('/api/tracking/sync-all', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.started) {
          console.debug('[SYNC] Background sync started:', data.data.message);
        }
      })
      .catch((err) => {
        console.debug('[SYNC] Background sync error:', err);
      });
  }, []);

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


  // Buscar dados completos do shipment para o modal de etiqueta
  const { data: shipmentDetailForLabel } = useQuery<{
    label: { id: string; status: string } | null;
    volumes: Array<{ id: string; packageNumber: number; weight: number }>;
    hasDeclaration: boolean;
  }>({
    queryKey: ['shipment-label-detail', selectedShipmentForLabel?.id],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${selectedShipmentForLabel?.id}`);
      if (!res.ok) {
        throw new Error('Erro ao buscar dados do envio');
      }
      const json = await res.json();
      const data = json.data ?? json;
      const document = data.document as { type?: string } | null;
      return {
        label: data.label,
        volumes: data.volumes?.map((v: { id: string; packageNumber: number; weight: number }) => ({
          id: v.id,
          packageNumber: v.packageNumber,
          weight: v.weight,
        })) || [],
        hasDeclaration: document?.type === 'DECLARACAO',
      };
    },
    enabled: !!selectedShipmentForLabel?.id && labelModalOpen,
  });



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

  const handlePrintDocument = useCallback(async (shipmentId: string) => {
    setPrintingDocumentId(shipmentId);
    try {
      await fetchAndPrintShipmentDocument(shipmentId);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Não foi possível gerar o documento.');
    } finally {
      setPrintingDocumentId(null);
    }
  }, [message]);

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
            "Em trânsito": 4, "Em rota de entrega": 5, "Problema na entrega": 6,
            "Entregue": 7, "Cancelado": 8, "Devolvido": 9,
          };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        },
        render: (_value, row: Shipment) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.4, alignItems: 'center' }}>
            <ELStatusTag variant={STATUS_VARIANTS[row.status] ?? "default"} size="default">
              {row.status}
            </ELStatusTag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Criado: {formatDateBR(row.createdAt)}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Previsto: {formatDateBR(row.expectedDeliveryDate || new Date(new Date(row.createdAt).getTime() + row.etaDays * 86_400_000).toISOString())}
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
          // Só pode imprimir etiqueta se ainda não foi postado
          const canPrint = !row.postedAt;

          // Envios cancelados não mostram nenhuma ação
          if (row.status === "Cancelado") {
            return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
          }

          return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Tooltip title={canPrint ? "Imprimir etiqueta" : "Objeto já postado"}>
                <ELButton
                  variant="ghost"
                  size="small"
                  icon={<PrinterOutlined />}
                  disabled={!canPrint}
                  onClick={() => handleOpenLabelModal(row)}
                />
              </Tooltip>
              <Tooltip title="Imprimir declaração de conteúdo">
                <ELButton
                  variant="ghost"
                  size="small"
                  icon={<FileTextOutlined />}
                  loading={printingDocumentId === row.id}
                  onClick={() => handlePrintDocument(row.id)}
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
    [cancelMut, handleOpenLabelModal, handleOpenCancelConfirm, handlePrintDocument, printingDocumentId],
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
              style={{ flex: 1, minWidth: 0 }}
            />
            <ELSelect
              style={{ width: 180, flexShrink: 0 }}
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


      {/* Modal de impressão de etiqueta */}
      {selectedShipmentForLabel && (
        <ShipmentLabelPdfModal
          open={labelModalOpen}
          onClose={handleCloseLabelModal}
          shipmentId={selectedShipmentForLabel.id}
          trackingCode={selectedShipmentForLabel.trackingCode}
          volumes={shipmentDetailForLabel?.volumes || []}
          labelId={shipmentDetailForLabel?.label?.id}
          hasDeclaration={shipmentDetailForLabel?.hasDeclaration}
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
