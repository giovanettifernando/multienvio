"use client";

import {
  ArrowDownOutlined,
  FieldTimeOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Empty,
  Flex,
  Segmented,
  Table,
  Tag,
  Typography,
} from "antd";
import { ELButton } from "@/components/ui/ELButton";
import { ELCard } from "@/components/ui/ELCard";
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
      render: (value: string) => (
        <Typography.Text>{value}</Typography.Text>
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
        <ELButton
          variant="primary"
          icon={<LogoutOutlined />}
          onClick={() => onSelect(record)}
        >
          Selecionar
        </ELButton>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <ELCard
        header={{
          title: "Resultados",
          extra: (
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
          ),
        }}
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
      </ELCard>
    </Flex>
  );
}
