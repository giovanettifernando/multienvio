"use client";

import { Alert, Card, Empty, Skeleton, Table, Typography } from "antd";
import type { TableProps } from 'antd';
import type { InvoiceItem } from "@/shared/types/invoice";

export interface InvoiceItemsTableProps {
  items: InvoiceItem[] | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function InvoiceItemsTable({
  items,
  loading = false,
  error = null,
  onRetry,
}: InvoiceItemsTableProps) {
  const columns: TableProps<InvoiceItem>['columns'] = [
    {
      title: "#",
      key: "index",
      width: 60,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Descrição",
      dataIndex: "descricao",
      key: "descricao",
      ellipsis: true,
    },
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 120,
      render: (sku: string | null) => sku || "-",
    },
    {
      title: "NCM",
      dataIndex: "ncm",
      key: "ncm",
      width: 100,
      render: (ncm: string | null) => ncm || "-",
    },
    {
      title: "CFOP",
      dataIndex: "cfop",
      key: "cfop",
      width: 80,
      render: (cfop: string | null) => cfop || "-",
    },
    {
      title: "Qtd.",
      dataIndex: "quantidade",
      key: "quantidade",
      width: 80,
      align: "right",
      render: (qtd: number) => qtd.toFixed(2),
    },
    {
      title: "Peso líq. (kg)",
      dataIndex: "pesoLiquido",
      key: "pesoLiquido",
      width: 120,
      align: "right",
      render: (peso: number | null) => (peso ? peso.toFixed(3) : "-"),
    },
    {
      title: "Vlr. unitário",
      dataIndex: "valorUnitario",
      key: "valorUnitario",
      width: 120,
      align: "right",
      render: (valor: number) =>
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(valor),
    },
    {
      title: "Vlr. total",
      dataIndex: "valorTotal",
      key: "valorTotal",
      width: 120,
      align: "right",
      render: (valor: number) =>
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(valor),
    },
  ];

  if (loading) {
    return (
      <Card title="Itens da Nota Fiscal">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Itens da Nota Fiscal">
        <Alert
          type="error"
          message="Erro ao carregar itens"
          description={error}
          showIcon
          action={
            onRetry ? (
              <Typography.Link onClick={onRetry}>Tentar novamente</Typography.Link>
            ) : undefined
          }
        />
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card title="Itens da Nota Fiscal">
        <Empty description="Nenhum item encontrado na NF-e enviada" />
      </Card>
    );
  }

  return (
    <Card title="Itens da Nota Fiscal">
      <Table<InvoiceItem>
        rowKey="id"
        columns={columns}
        dataSource={items}
        size="small"
        pagination={false}
        scroll={{ x: 1000 }}
        bordered
      />
    </Card>
  );
}
