"use client";

import React from "react";
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
  items: PublicVolumeItem[];
};

interface PublicShipmentItemsProps {
  volumes: PublicVolume[];
}

export function PublicShipmentItems({ volumes }: PublicShipmentItemsProps) {
  console.log('[PublicShipmentItems] Recebido:', { volumes, count: volumes?.length });

  if (!volumes || volumes.length === 0) {
    console.log('[PublicShipmentItems] Nenhum volume para exibir');
    return null;
  }

  // Se houver apenas 1 volume, mostrar diretamente sem acordeão
  if (volumes.length === 1) {
    const volume = volumes[0];
    return (
      <Card
        title="Itens do envio"
        styles={{ body: { padding: "16px" } }}
      >
        {volume.documentType === 'NF' && volume.nfKey && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              NF-e: {volume.nfKey.substring(0, 4)} ... {volume.nfKey.substring(volume.nfKey.length - 4)}
            </Text>
          </div>
        )}

        <Table
          dataSource={volume.items}
          pagination={false}
          size="small"
          rowKey={(_, index) => `item-${index}`}
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
      </Card>
    );
  }

  // Múltiplos volumes: usar acordeão
  const collapseItems = volumes.map((volume) => ({
    key: volume.index.toString(),
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <InboxOutlined />
        <Text strong>Volume {volume.index}</Text>
        {volume.documentType === 'NF' && (
          <Tag color="blue" style={{ marginLeft: 8 }}>NF-e</Tag>
        )}
      </div>
    ),
    children: (
      <div>
        {volume.documentType === 'NF' && volume.nfKey && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              NF-e: {volume.nfKey.substring(0, 4)} ... {volume.nfKey.substring(volume.nfKey.length - 4)}
            </Text>
          </div>
        )}

        <Table
          dataSource={volume.items}
          pagination={false}
          size="small"
          rowKey={(_, index) => `vol-${volume.index}-item-${index}`}
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
      </div>
    ),
  }));

  return (
    <Card title="Itens do envio" styles={{ body: { padding: 0 } }}>
      <Collapse
        items={collapseItems}
        defaultActiveKey={volumes.map(v => v.index.toString())}
        ghost
      />
    </Card>
  );
}
