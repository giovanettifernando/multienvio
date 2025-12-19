"use client";

import { useState } from "react";
import { ELTypography, ELSpace } from '@/shared/ui';
const Typography = ELTypography;
const Space = ELSpace;
import { EnvironmentOutlined, EyeOutlined } from "@ant-design/icons";
import { ELAlert, ELButton, ELSelect } from '@/shared/ui';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { formatDateTimeBR } from '@/shared/utils/date';
import {
  CollectionStatus,
  COLLECTION_STATUS_LABELS,
} from '@/shared/types/contracts';
import type { Coleta, ColetaStatus } from "@/modules/coletas/application/types";
import { useColetasActions } from "@/modules/coletas/ui/hooks";
import { ColetaDetailDrawer } from "./ColetaDetailDrawer";

interface ColetasTableProps {
  data: Coleta[];
  loading?: boolean;
}

export function ColetasTable({ data, loading }: ColetasTableProps) {
  const { updateStatus, remove } = useColetasActions();
  const [selectedColeta, setSelectedColeta] = useState<Coleta | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const formatEndereco = (coleta: Coleta) => {
    const { origem } = coleta;
    return `${origem.cidade}/${origem.uf} - CEP ${origem.cep}`;
  };

  const handleStatusChange = (coletaId: string, newStatus: ColetaStatus) => {
    updateStatus(coletaId, newStatus);
  };

  const handleRemove = (coletaId: string) => {
    if (confirm("Tem certeza que deseja remover esta coleta?")) {
      remove(coletaId);
    }
  };

  const columns: DataTableColumn<Coleta>[] = [
    {
      title: "ID do Envio",
      dataIndex: "shipmentId",
      key: "shipmentId",
      width: 180,
      render: (shipmentId: unknown) => (
        <Typography.Text copyable strong>
          {String(shipmentId)}
        </Typography.Text>
      ),
    },
    {
      title: "Origem",
      key: "origem",
      width: 250,
      render: (_: unknown, coleta: Coleta) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{coleta.origem.nome}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <EnvironmentOutlined /> {formatEndereco(coleta)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Transportadora / Serviço",
      key: "transportadora",
      width: 200,
      render: (_: unknown, coleta: Coleta) => (
        <Space orientation="vertical" size={0}>
          {coleta.transportadora && (
            <Typography.Text>{coleta.transportadora}</Typography.Text>
          )}
          {coleta.servico && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {coleta.servico}
            </Typography.Text>
          )}
          {!coleta.transportadora && !coleta.servico && (
            <Typography.Text type="secondary">—</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (status: unknown, record: Coleta) => (
        <ELSelect
          value={status as ColetaStatus}
          style={{ width: "100%" }}
          onChange={(newStatus) => handleStatusChange(record.id, newStatus as ColetaStatus)}
          options={[
            {
              label: COLLECTION_STATUS_LABELS[CollectionStatus.ABERTA],
              value: CollectionStatus.ABERTA,
            },
            {
              label: COLLECTION_STATUS_LABELS[CollectionStatus.AGENDADA],
              value: CollectionStatus.AGENDADA,
            },
            {
              label: COLLECTION_STATUS_LABELS[CollectionStatus.EM_ANDAMENTO],
              value: CollectionStatus.EM_ANDAMENTO,
            },
            {
              label: COLLECTION_STATUS_LABELS[CollectionStatus.CONCLUIDA],
              value: CollectionStatus.CONCLUIDA,
            },
            {
              label: COLLECTION_STATUS_LABELS[CollectionStatus.CANCELADA],
              value: CollectionStatus.CANCELADA,
            },
          ]}
        />
      ),
    },
    {
      title: "Criado em",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: unknown) => (
        <Typography.Text type="secondary">{formatDateTimeBR(date as string)}</Typography.Text>
      ),
    },
    {
      title: "Atualizado em",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      sorter: (a: Coleta, b: Coleta) => a.updatedAt.localeCompare(b.updatedAt),
      render: (date: unknown) => (
        <Typography.Text>{formatDateTimeBR(date as string)}</Typography.Text>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 150,
      fixed: "right",
      isActions: true,
      render: (_: unknown, coleta: Coleta) => (
        <Space size="small">
          <ELButton
            variant="link"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => {
              setSelectedColeta(coleta);
              setDetailDrawerOpen(true);
            }}
          >
            Detalhes
          </ELButton>
          <ELButton
            variant="link"
            danger
            size="small"
            onClick={() => handleRemove(coleta.id)}
          >
            Remover
          </ELButton>
        </Space>
      ),
    },
  ];

  const handleCloseDetail = () => {
    setDetailDrawerOpen(false);
    setSelectedColeta(null);
  };

  if (data.length === 0 && !loading) {
    return (
      <ELAlert
        variant="info"
        showIcon
        message="Nenhuma coleta cadastrada ainda"
        description="As coletas serão criadas automaticamente quando você finalizar um checkout com a opção 'Solicitar coleta na origem' ativada."
      />
    );
  }

  return (
    <>
      <DataTable<Coleta>
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        enableMobileCards={true}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total} coletas`,
        }}
        scrollX={1200}
        scrollY="calc(100vh - 400px)"
      />

      <ColetaDetailDrawer
        open={detailDrawerOpen}
        onClose={handleCloseDetail}
        coleta={selectedColeta}
      />
    </>
  );
}
