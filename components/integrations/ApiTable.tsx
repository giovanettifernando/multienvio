'use client';

import { useState } from 'react';
import { Table, Button, Space, Tag, Switch, Modal, Empty, Flex, Select, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { message as antMessage } from 'antd';
import dayjs from 'dayjs';
import type { CarrierApi } from '@/lib/integrations/types';
import { useApis, useUpdateApi, useDeleteApi, useCarriers } from '@/lib/integrations/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';

export default function ApiTable() {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | undefined>();
  const { data: carriers } = useCarriers();
  const { data: apis, isLoading } = useApis(selectedCarrierId);
  const updateApi = useUpdateApi();
  const deleteApi = useDeleteApi();
  const openApiDrawer = useIntegrationsStore((state) => state.openApiDrawer);

  const handleToggleActive = (api: CarrierApi) => {
    updateApi.mutate({
      id: api.id,
      data: { active: !api.active },
    });
  };

  const handleEdit = (api: CarrierApi) => {
    openApiDrawer(api.carrierId, api);
  };

  const handleDelete = (api: CarrierApi) => {
    Modal.confirm({
      title: 'Excluir API',
      content: 'Tem certeza que deseja excluir esta configuração de API? Esta ação não pode ser desfeita.',
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => {
        deleteApi.mutate(api.id);
      },
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    antMessage.success('URL copiada');
  };

  const columns = [
    {
      title: 'Transportadora',
      dataIndex: 'carrierId',
      key: 'carrierId',
      width: 150,
      render: (carrierId: string) => {
        const carrier = carriers?.find((c) => c.id === carrierId);
        return carrier?.name || carrierId;
      },
    },
    {
      title: 'Ambiente',
      dataIndex: 'environment',
      key: 'environment',
      width: 120,
      render: (env: string) => (
        <Tag color={env === 'production' ? 'green' : 'orange'}>
          {env === 'production' ? 'Produção' : 'Sandbox'}
        </Tag>
      ),
    },
    {
      title: 'Quote URL',
      dataIndex: 'quoteUrl',
      key: 'quoteUrl',
      width: 220,
      ellipsis: true,
      render: (url: string | undefined) =>
        url ? (
          <Tooltip title={url}>
            <Space size={4}>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{url}</span>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyUrl(url)}
              />
            </Space>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    {
      title: 'Label URL',
      dataIndex: 'labelUrl',
      key: 'labelUrl',
      width: 220,
      ellipsis: true,
      render: (url: string | undefined) =>
        url ? (
          <Tooltip title={url}>
            <Space size={4}>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{url}</span>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyUrl(url)}
              />
            </Space>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    {
      title: 'Tracking URL',
      dataIndex: 'trackingUrl',
      key: 'trackingUrl',
      width: 220,
      ellipsis: true,
      render: (url: string | undefined) =>
        url ? (
          <Tooltip title={url}>
            <Space size={4}>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{url}</span>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyUrl(url)}
              />
            </Space>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean, record: CarrierApi) => (
        <Switch
          checked={active}
          onChange={() => handleToggleActive(record)}
          checkedChildren="Ativo"
          unCheckedChildren="Inativo"
        />
      ),
    },
    {
      title: 'Atualizado em',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YY HH:mm'),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: CarrierApi) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Editar
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Excluir
          </Button>
        </Space>
      ),
    },
  ];

  const enabledCarriers = carriers?.filter((c) => c.enabled) || [];

  if (!isLoading && (!apis || apis.length === 0)) {
    return (
      <Empty
        description="Nenhuma API cadastrada"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        {enabledCarriers.length > 0 && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              if (enabledCarriers.length === 1) {
                openApiDrawer(enabledCarriers[0].id);
              } else {
                antMessage.info('Selecione uma transportadora acima');
              }
            }}
          >
            Adicionar API
          </Button>
        )}
      </Empty>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Select
          placeholder="Filtrar por transportadora"
          style={{ width: 240 }}
          allowClear
          value={selectedCarrierId}
          onChange={setSelectedCarrierId}
          options={enabledCarriers.map((c) => ({
            label: c.name,
            value: c.id,
          }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            if (selectedCarrierId) {
              openApiDrawer(selectedCarrierId);
            } else if (enabledCarriers.length === 1) {
              openApiDrawer(enabledCarriers[0].id);
            } else {
              antMessage.info('Selecione uma transportadora primeiro');
            }
          }}
        >
          Adicionar API
        </Button>
      </Flex>
      <Table
        columns={columns}
        dataSource={apis || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1400 }}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `Total: ${total} APIs`,
          showSizeChanger: false,
        }}
        size="small"
      />
    </Flex>
  );
}
