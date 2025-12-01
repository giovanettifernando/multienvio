import { useMemo } from "react";
import { Button, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CartItem } from "@/types/cart";

type CartTableProps = {
  items: CartItem[];
  onRemove: (item: CartItem) => void;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function CartTable({ items, onRemove }: CartTableProps) {
  const columns = useMemo<ColumnsType<CartItem>>(
    () => [
      {
        title: "Transportadora / Modalidade",
        dataIndex: "transportadora",
        key: "transportadora",
        render: (_value, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.transportadora}</Typography.Text>
            <Typography.Text type="secondary">
              {record.modalidade}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Rotas",
        key: "rotas",
        render: (_value, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              Origem: {record.origem?.cep ?? "—"}{" "}
              {record.origem?.cidadeUF ? `(${record.origem?.cidadeUF})` : ""}
            </Typography.Text>
            <Typography.Text>
              Destino: {record.destino?.cep ?? "—"}{" "}
              {record.destino?.cidadeUF ? `(${record.destino?.cidadeUF})` : ""}
            </Typography.Text>
            <Space>
              {record.coleta ? <Tag color="blue">Coleta</Tag> : null}
              {record.devolucao ? <Tag color="orange">Devolução</Tag> : null}
            </Space>
          </Space>
        ),
      },
      {
        title: "Volumes",
        key: "volumes",
        render: (_value, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {record.volumes.length} volume(s)
            </Typography.Text>
            <Typography.Text type="secondary">
              Peso: {record.pesoTotalKg.toFixed(2)} kg | Cubado:{" "}
              {record.pesoCubadoTotalKg.toFixed(2)} kg
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Preço",
        dataIndex: "preco",
        key: "preco",
        render: (value: number) => (
          <Typography.Text strong style={{ whiteSpace: "nowrap" }}>
            {currencyFormatter.format(value)}
          </Typography.Text>
        ),
      },
      {
        title: "Ações",
        key: "actions",
        render: (_value, record) => (
          <Space>
            <Button danger onClick={() => onRemove(record)}>
              Remover
            </Button>
          </Space>
        ),
      },
    ],
    [onRemove],
  );

  return (
    <Table<CartItem>
      rowKey="id"
      columns={columns}
      dataSource={items}
      pagination={false}
      scroll={{ x: 800 }}
    />
  );
}

export default CartTable;
