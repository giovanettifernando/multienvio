"use client";

import {
  ArrowDownOutlined,
  FieldTimeOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Empty,
  Flex,
  Segmented,
  Table,
  Tag,
  Typography,
  Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import type { QuoteResultItem } from "@/types/quote";

type SortOrder = "price" | "prazo";

type ResultsTableProps = {
  results: QuoteResultItem[];
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  onSelect: (result: QuoteResultItem) => void;
  loading?: boolean;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const sortResults = (results: QuoteResultItem[], order: SortOrder) => {
  const items = [...results];
  if (order === "price") {
    items.sort((a, b) => a.preco - b.preco);
  } else {
    items.sort((a, b) => a.prazoDias - b.prazoDias);
  }
  return items;
};

const buildAvatarLabel = (carrier: string) => {
  const initials = carrier
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "T";
};

export function ResultsTable({
  results,
  sortOrder,
  onSortChange,
  onSelect,
  loading,
}: ResultsTableProps) {
  const sorted = useMemo(
    () => sortResults(results, sortOrder),
    [results, sortOrder],
  );

  // Verifica se há cotações mockadas
  const hasMockQuotes = useMemo(
    () => results.some((r) => r.source === "mock"),
    [results],
  );

  const columns: ColumnsType<QuoteResultItem> = [
    {
      title: "Transportadora",
      dataIndex: "carrier",
      key: "carrier",
      render: (value: string) => (
        <Flex align="center" gap={12}>
          <Avatar
            shape="square"
            style={{ backgroundColor: "#1d39c4", color: "#fff" }}
          >
            {buildAvatarLabel(value)}
          </Avatar>
          <div>
            <Typography.Text strong>{value}</Typography.Text>
          </div>
        </Flex>
      ),
    },
    {
      title: "Modalidade",
      dataIndex: "modalidade",
      key: "modalidade",
      render: (value: string, record: QuoteResultItem) => (
        <Flex align="center" gap={8}>
          <Typography.Text>{value}</Typography.Text>
          {record.source === "mock" && (
            <Tag color="orange" bordered={false}>
              Mock
            </Tag>
          )}
        </Flex>
      ),
    },
    {
      title: "Prazo estimado",
      dataIndex: "prazoDias",
      key: "prazoDias",
      render: (value: number) => (
        <Flex align="center" gap={6}>
          <FieldTimeOutlined />
          <Typography.Text>
            {value === 1 ? "1 dia útil" : `${value} dias úteis`}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Preço",
      dataIndex: "preco",
      key: "preco",
      render: (value: number) => (
        <Flex align="center" gap={6}>
          <ArrowDownOutlined style={{ color: "#389e0d" }} />
          <Typography.Text strong>{currency.format(value)}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Seguro",
      dataIndex: "exigeSeguro",
      key: "exigeSeguro",
      render: (value: boolean) =>
        value ? (
          <Tag icon={<SafetyCertificateOutlined />} color="volcano">
            Obrigatório
          </Tag>
        ) : (
          <Tag color="blue">Opcional</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      render: (_value, record) => (
        <Button
          type="primary"
          icon={<LogoutOutlined />}
          onClick={() => onSelect(record)}
        >
          Selecionar
        </Button>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card
        title="Resultados"
        extra={
          <Flex align="center" gap={8}>
            <Typography.Text type="secondary">Ordenar por</Typography.Text>
            <Segmented<SortOrder>
              value={sortOrder}
              onChange={(value) => onSortChange(value as SortOrder)}
              options={[
                { label: "Mais barato", value: "price" },
                { label: "Menor prazo", value: "prazo" },
              ]}
            />
          </Flex>
        }
      >
        <Table
          locale={{
            emptyText: (
              <Empty description="Nenhuma cotação encontrada com os filtros atuais." />
            ),
          }}
          dataSource={sorted}
          columns={columns}
          rowKey={(record) => record.id}
          pagination={false}
          loading={loading}
        />
      </Card>

      {hasMockQuotes && (
        <Alert
          message="Algumas cotações estão em modo simulado"
          description="Algumas opções foram geradas automaticamente por indisponibilidade de integração. Os valores e prazos podem variar ao confirmar o envio."
          type="warning"
          icon={<InfoCircleOutlined />}
          showIcon
          closable
        />
      )}
    </Flex>
  );
}
