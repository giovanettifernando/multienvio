"use client";

import { Card, Collapse, Table, Typography, Tag } from "antd";
import { InboxOutlined } from "@ant-design/icons";

const { Text } = Typography;

export type PublicVolumeItem = {
  description: string;
  quantity: number;
  unitValue?: number;
  subtotal?: number;
};

export type PublicVolume = {
  index: number;
  documentType: 'DECLARATION' | 'NF';
  nfKey?: string;
  // Dimensões do volume
  height?: number;
  width?: number;
  length?: number;
  weight?: number;
  items: PublicVolumeItem[];
};

// Componente para exibir detalhes de dimensões do volume
function VolumeDimensions({ volume }: { volume: PublicVolume }) {
  const hasDimensions = volume.height || volume.width || volume.length || volume.weight;

  if (!hasDimensions) return null;

  const dimensions = [];
  if (volume.height && volume.width && volume.length) {
    dimensions.push(`${volume.height} x ${volume.width} x ${volume.length} cm`);
  }
  if (volume.weight) {
    dimensions.push(`${volume.weight} kg`);
  }

  return (
    <div style={{
      marginBottom: 12,
      padding: '8px 12px',
      backgroundColor: '#fafafa',
      borderRadius: 4,
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap'
    }}>
      {volume.height && volume.width && volume.length && (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>Dimensões</Text>
          <div><Text style={{ fontSize: 13 }}>{volume.height} x {volume.width} x {volume.length} cm</Text></div>
        </div>
      )}
      {volume.weight && (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>Peso</Text>
          <div><Text style={{ fontSize: 13 }}>{volume.weight} kg</Text></div>
        </div>
      )}
    </div>
  );
}

interface PublicShipmentItemsProps {
  volumes: PublicVolume[];
}

export function PublicShipmentItems({ volumes }: PublicShipmentItemsProps) {
  if (!volumes || volumes.length === 0) {
    return null;
  }

  // Se houver apenas 1 volume, mostrar diretamente sem acordeão
  if (volumes.length === 1) {
    const volume = volumes[0];
    const hasItems = volume.items && volume.items.length > 0;

    return (
      <Card
        title="Detalhes do volume"
        styles={{ body: { padding: "16px" } }}
      >
        {/* Dimensões do volume */}
        <VolumeDimensions volume={volume} />

        {volume.documentType === 'NF' && volume.nfKey && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              NF-e: {volume.nfKey.substring(0, 4)} ... {volume.nfKey.substring(volume.nfKey.length - 4)}
            </Text>
          </div>
        )}

        {hasItems ? (
          <Table
            dataSource={volume.items}
            pagination={false}
            size="small"
            rowKey={(record) => `${record.description}-${record.quantity}-${record.unitValue ?? 0}`}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: 'Descrição',
                dataIndex: 'description',
                key: 'description',
                width: '50%',
              },
              {
                title: 'Qtd',
                dataIndex: 'quantity',
                key: 'quantity',
                align: 'center',
                width: 80,
              },
              ...(volume.items.some(item => item.unitValue !== undefined) ? [
                {
                  title: 'Valor unit.',
                  dataIndex: 'unitValue',
                  key: 'unitValue',
                  align: 'right' as const,
                  width: 120,
                  render: (value: number | undefined) =>
                    value !== undefined
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(value)
                      : '-',
                },
              ] : []),
              ...(volume.items.some(item => item.subtotal !== undefined) ? [
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  align: 'right' as const,
                  width: 120,
                  render: (value: number | undefined) =>
                    value !== undefined
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(value)
                      : '-',
                },
              ] : []),
            ]}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Informações detalhadas dos itens não disponíveis.
          </Text>
        )}
      </Card>
    );
  }

  // Múltiplos volumes: usar acordeão
  const collapseItems = volumes.map((volume) => ({
    key: volume.index.toString(),
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <InboxOutlined />
        <Text strong>Volume {volume.index}</Text>
        {volume.documentType === 'NF' && (
          <Tag color="blue">NF-e</Tag>
        )}
        {volume.weight && (
          <Text type="secondary" style={{ fontSize: 12 }}>{volume.weight} kg</Text>
        )}
        {volume.height && volume.width && volume.length && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({volume.height}x{volume.width}x{volume.length} cm)
          </Text>
        )}
      </div>
    ),
    children: (
      <div>
        {/* Dimensões do volume */}
        <VolumeDimensions volume={volume} />

        {volume.documentType === 'NF' && volume.nfKey && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              NF-e: {volume.nfKey.substring(0, 4)} ... {volume.nfKey.substring(volume.nfKey.length - 4)}
            </Text>
          </div>
        )}

        {volume.items && volume.items.length > 0 ? (
          <Table
            dataSource={volume.items}
            pagination={false}
            size="small"
            rowKey={(record) => `vol-${volume.index}-${record.description}-${record.quantity}-${record.unitValue ?? 0}`}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: 'Descrição',
                dataIndex: 'description',
                key: 'description',
                width: '50%',
              },
              {
                title: 'Qtd',
                dataIndex: 'quantity',
                key: 'quantity',
                align: 'center',
                width: 80,
              },
              ...(volume.items.some(item => item.unitValue !== undefined) ? [
                {
                  title: 'Valor unit.',
                  dataIndex: 'unitValue',
                  key: 'unitValue',
                  align: 'right' as const,
                  width: 120,
                  render: (value: number | undefined) =>
                    value !== undefined
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(value)
                      : '-',
                },
              ] : []),
              ...(volume.items.some(item => item.subtotal !== undefined) ? [
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  align: 'right' as const,
                  width: 120,
                  render: (value: number | undefined) =>
                    value !== undefined
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(value)
                      : '-',
                },
              ] : []),
            ]}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Informações detalhadas dos itens não disponíveis.
          </Text>
        )}
      </div>
    ),
  }));

  return (
    <Card title="Detalhes dos volumes" styles={{ body: { padding: 0 } }}>
      <Collapse
        items={collapseItems}
        defaultActiveKey={volumes.map(v => v.index.toString())}
        ghost
      />
    </Card>
  );
}
