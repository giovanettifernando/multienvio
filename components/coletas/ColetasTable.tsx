"use client";

import { useState } from "react";
import Table from "antd/es/table";
import Typography from "antd/es/typography";
import Space from "antd/es/space";
import Alert from "antd/es/alert";
import { EnvironmentOutlined, EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { ELButton } from "@/components/ui/ELButton";
import { ELSelect } from "@/components/ui/ELSelect";
import {
  CollectionStatus,
  COLLECTION_STATUS_LABELS,
} from "@/types/contracts";
import type { Coleta, ColetaStatus } from "@/lib/coletas/types";
import { useColetasActions } from "@/hooks/useColetas";
import { ColetaDetailDrawer } from "./ColetaDetailDrawer";

interface ColetasTableProps {
  data: Coleta[];
  loading?: boolean;
}

export function ColetasTable({ data, loading }: ColetasTableProps) {
  const { updateStatus, remove } = useColetasActions();
  const [selectedColeta, setSelectedColeta] = useState<Coleta | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return dayjs(dateString).format("DD/MM/YYYY HH:mm");
  };

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

  const columns: ColumnsType<Coleta> = [
    {
      title: "ID do Envio",
      dataIndex: "shipmentId",
      key: "shipmentId",
      width: 180,
      render: (shipmentId: string) => (
        <Typography.Text copyable strong>
          {shipmentId}
        </Typography.Text>
      ),
    },
    {
      title: "Origem",
      key: "origem",
      width: 250,
      render: (_, coleta) => (
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
      render: (_, coleta) => (
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
      render: (status: ColetaStatus, record) => (
        <ELSelect
          value={status}
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
      render: (date: string) => (
        <Typography.Text type="secondary">{formatDate(date)}</Typography.Text>
      ),
    },
    {
      title: "Atualizado em",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
      render: (date: string) => (
        <Typography.Text>{formatDate(date)}</Typography.Text>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_, coleta) => (
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
      <Alert
        type="info"
        showIcon
        message="Nenhuma coleta cadastrada ainda"
        description="As coletas serão criadas automaticamente quando você finalizar um checkout com a opção 'Solicitar coleta na origem' ativada."
      />
    );
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        showTotal: (total) => `Total: ${total} coletas`,
      }}
      scroll={{ x: 1200, y: 'calc(100vh - 400px)' }}
    />

      <ColetaDetailDrawer
        open={detailDrawerOpen}
        onClose={handleCloseDetail}
        coleta={selectedColeta}
      />
    </>
  );
}
