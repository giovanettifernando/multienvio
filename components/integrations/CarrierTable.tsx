'use client';

import { Table, Button, Space, Tag, Switch, Image, Modal, Empty, Flex } from 'antd';
import { PlusOutlined, EditOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Carrier, CarrierService } from '@/lib/integrations/types';
import { useCarriers, useUpdateCarrier, useDeleteCarrier } from '@/lib/integrations/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';

const serviceLabels: Record<CarrierService, string> = {
  quote: 'Cotação',
  label: 'Etiqueta',
  tracking: 'Rastreamento',
};

const serviceColors: Record<CarrierService, string> = {
  quote: 'blue',
  label: 'green',
  tracking: 'orange',
};

export default function CarrierTable() {
  const { data: carriers, isLoading } = useCarriers();
  const updateCarrier = useUpdateCarrier();
  const deleteCarrier = useDeleteCarrier();
  const openCarrierDrawer = useIntegrationsStore((state) => state.openCarrierDrawer);

  const handleToggleEnabled = (carrier: Carrier) => {
    updateCarrier.mutate({
      id: carrier.id,
      data: { enabled: !carrier.enabled },
    });
  };

  const handleEdit = (carrier: Carrier) => {
    openCarrierDrawer(carrier);
  };

  const handleDuplicate = (carrier: Carrier) => {
    openCarrierDrawer({
      ...carrier,
      id: '',
      name: `${carrier.name} (cópia)`,
      slug: `${carrier.slug}-copy`,
    });
  };

  const handleDelete = (carrier: Carrier) => {
    Modal.confirm({
      title: 'Excluir transportadora',
      content: `Tem certeza que deseja excluir a transportadora "${carrier.name}"? Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => {
        deleteCarrier.mutate(carrier.id);
      },
    });
  };

  const columns = [
    {
      title: 'Logo',
      dataIndex: 'logoUrl',
      key: 'logoUrl',
      width: 80,
      render: (logoUrl: string | undefined, record: Carrier) =>
        logoUrl ? (
          <Image
            src={logoUrl}
            alt={record.name}
            width={40}
            height={40}
            style={{ objectFit: 'contain' }}
            preview={false}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#999',
            }}
          >
            {record.name.substring(0, 2).toUpperCase()}
          </div>
        ),
    },
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      width: 150,
      render: (slug: string) => <Tag color="default">{slug}</Tag>,
    },
    {
      title: 'Serviços',
      dataIndex: 'services',
      key: 'services',
      width: 280,
      render: (services: CarrierService[]) => (
        <Space size={4} wrap>
          {services.map((service) => (
            <Tag key={service} color={serviceColors[service]}>
              {serviceLabels[service]}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record: Carrier) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
          checkedChildren="Ativa"
          unCheckedChildren="Inativa"
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
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: Carrier) => (
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
            icon={<CopyOutlined />}
            onClick={() => handleDuplicate(record)}
          >
            Duplicar
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

  if (!isLoading && (!carriers || carriers.length === 0)) {
    return (
      <Empty
        description="Nenhuma transportadora cadastrada"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCarrierDrawer()}
        >
          Adicionar transportadora
        </Button>
      </Empty>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="flex-end">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCarrierDrawer()}
        >
          Adicionar transportadora
        </Button>
      </Flex>
      <Table
        columns={columns}
        dataSource={carriers || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `Total: ${total} transportadoras`,
          showSizeChanger: false,
        }}
        size="small"
      />
    </Flex>
  );
}
