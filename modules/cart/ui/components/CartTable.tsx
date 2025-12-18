import { useMemo } from "react";
import { Button, Card, Space, Table, Tag, Typography, Grid } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { TableProps } from 'antd';
import type { CartItem } from '@/shared/types/cart';

const { useBreakpoint } = Grid;

type CartTableProps = {
  items: CartItem[];
  onRemove: (item: CartItem) => void;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function CartTable({ items, onRemove }: CartTableProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const columns = useMemo<TableProps<CartItem>['columns']>(
    () => [
      {
        title: "Transportadora / Modalidade",
        dataIndex: "transportadora",
        key: "transportadora",
        render: (_value, record) => (
          <Space orientation="vertical" size={0}>
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
          <Space orientation="vertical" size={0}>
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
          <Space orientation="vertical" size={0}>
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

  // Mobile: Card layout
  if (isMobile) {
    return (
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        {items.map((item) => (
          <Card
            key={item.id}
            size="small"
            styles={{ body: { padding: 12 } }}
          >
            {/* Header: Transportadora + Preço */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {item.transportadora}
                </Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {item.modalidade}
                </Typography.Text>
              </div>
              <Typography.Text strong style={{ fontSize: 16, color: "var(--color-primary)" }}>
                {currencyFormatter.format(item.preco)}
              </Typography.Text>
            </div>

            {/* Rotas */}
            <div style={{ marginBottom: 8, fontSize: 12 }}>
              <div>
                <Typography.Text type="secondary">Origem: </Typography.Text>
                <Typography.Text>
                  {item.origem?.cep ?? "—"} {item.origem?.cidadeUF ? `(${item.origem.cidadeUF})` : ""}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">Destino: </Typography.Text>
                <Typography.Text>
                  {item.destino?.cep ?? "—"} {item.destino?.cidadeUF ? `(${item.destino.cidadeUF})` : ""}
                </Typography.Text>
              </div>
            </div>

            {/* Tags + Volumes + Ação */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Space size={4} wrap>
                <Tag style={{ margin: 0 }}>{item.volumes.length} vol</Tag>
                <Tag style={{ margin: 0 }}>{item.pesoTotalKg.toFixed(1)} kg</Tag>
                {item.coleta ? <Tag color="blue" style={{ margin: 0 }}>Coleta</Tag> : null}
                {item.devolucao ? <Tag color="orange" style={{ margin: 0 }}>Devolução</Tag> : null}
              </Space>
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => onRemove(item)}
              >
                Remover
              </Button>
            </div>
          </Card>
        ))}
      </Space>
    );
  }

  // Desktop: Table layout
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
