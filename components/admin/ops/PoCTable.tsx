'use client';

import { useState } from 'react';
import { Table, Button, Flex, Input, Select, Switch, Modal, Form, InputNumber, message } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import type { PointOfCollection } from '@/lib/admin/ops/types';
import { listPoC, togglePoCActive, updatePoC } from '@/lib/admin/ops/api';

export default function PoCTable() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  // Filters
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>();
  const [cityFilter, setCityFilter] = useState('');

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPoC, setEditingPoC] = useState<PointOfCollection | null>(null);

  // Fetch PoCs
  const { data: pocs, isLoading } = useQuery({
    queryKey: ['admin', 'ops', 'pocs'],
    queryFn: () => listPoC({ page: 1, pageSize: 100 }),
  });

  // Filtered PoCs
  const filteredPoCs = pocs?.filter((poc) => {
    if (activeFilter !== undefined && poc.active !== activeFilter) return false;
    if (cityFilter && !poc.city.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    if (
      search &&
      !poc.name.toLowerCase().includes(search.toLowerCase()) &&
      !poc.code.toLowerCase().includes(search.toLowerCase()) &&
      !poc.address.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Toggle active
  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await togglePoCActive(id, !currentActive);

      // Optimistic update
      queryClient.setQueryData(['admin', 'ops', 'pocs'], (old: PointOfCollection[] | undefined) => {
        if (!old) return old;
        return old.map((p) => (p.id === id ? { ...p, active: !currentActive } : p));
      });

      message.success(`PoC ${!currentActive ? 'ativado' : 'desativado'} com sucesso`);
    } catch {
      message.error('Erro ao atualizar PoC');
    }
  };

  // Open edit modal
  const openEditModal = (poc: PointOfCollection) => {
    setEditingPoC(poc);
    form.setFieldsValue({
      commissionPerItem: poc.commissionPerItem,
      capacityDaily: poc.capacityDaily,
      contact: poc.contact,
    });
    setEditModalOpen(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingPoC) return;

    try {
      const values = await form.validateFields();
      await updatePoC(editingPoC.id, values);

      // Optimistic update
      queryClient.setQueryData(['admin', 'ops', 'pocs'], (old: PointOfCollection[] | undefined) => {
        if (!old) return old;
        return old.map((p) => (p.id === editingPoC.id ? { ...p, ...values } : p));
      });

      message.success('PoC atualizado com sucesso');
      setEditModalOpen(false);
      setEditingPoC(null);
      form.resetFields();
    } catch {
      message.error('Erro ao atualizar PoC');
    }
  };

  const columns = [
    {
      title: 'Nome/Código',
      key: 'name',
      width: 200,
      render: (_: unknown, record: PointOfCollection) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.code}</div>
        </div>
      ),
    },
    {
      title: 'Endereço',
      dataIndex: 'address',
      key: 'address',
      width: 280,
    },
    {
      title: 'Cidade/UF',
      key: 'location',
      width: 150,
      render: (_: unknown, record: PointOfCollection) => `${record.city}/${record.state}`,
    },
    {
      title: 'Comissão/Item',
      dataIndex: 'commissionPerItem',
      key: 'commissionPerItem',
      width: 120,
      render: (value: number) => `R$ ${value.toFixed(2)}`,
    },
    {
      title: 'Capacidade Diária',
      dataIndex: 'capacityDaily',
      key: 'capacityDaily',
      width: 140,
      render: (value: number | null) => (value !== null ? value : '—'),
    },
    {
      title: 'Fila Atual',
      dataIndex: 'itemsAwaiting',
      key: 'itemsAwaiting',
      width: 100,
      render: (value: number) => value,
    },
    {
      title: 'Recebidos Hoje',
      dataIndex: 'itemsReceivedToday',
      key: 'itemsReceivedToday',
      width: 130,
      render: (value: number) => value,
    },
    {
      title: 'Ativo',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean, record: PointOfCollection) => (
        <Switch
          checked={active}
          onChange={() => handleToggleActive(record.id, active)}
          checkedChildren="Sim"
          unCheckedChildren="Não"
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: PointOfCollection) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEditModal(record)}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <>
      <Flex vertical gap={16}>
        {/* Filters */}
        <Flex gap={8} wrap="wrap">
          <Input
            placeholder="Buscar PoC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="Status"
            value={activeFilter}
            onChange={setActiveFilter}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: true, label: 'Ativo' },
              { value: false, label: 'Inativo' },
            ]}
          />
          <Input
            placeholder="Cidade/UF"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{ width: 160 }}
            allowClear
          />
        </Flex>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredPoCs || []}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `Total: ${total} PoCs`,
            showSizeChanger: false,
          }}
          size="small"
        />
      </Flex>

      {/* Edit Modal */}
      <Modal
        title="Editar Ponto de Coleta"
        open={editModalOpen}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingPoC(null);
          form.resetFields();
        }}
        okText="Salvar"
        cancelText="Cancelar"
      >
        {editingPoC && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div style={{ fontWeight: 500 }}>{editingPoC.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{editingPoC.code}</div>
            </div>
            <Form form={form} layout="vertical">
              <Form.Item
                name="commissionPerItem"
                label="Comissão por Item (R$)"
                rules={[{ required: true, message: 'Campo obrigatório' }]}
              >
                <InputNumber
                  min={0}
                  step={0.1}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="Ex: 2.50"
                />
              </Form.Item>
              <Form.Item
                name="capacityDaily"
                label="Capacidade Diária"
                rules={[{ required: true, message: 'Campo obrigatório' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Ex: 100"
                />
              </Form.Item>
              <Form.Item
                name="contact"
                label="Contato"
              >
                <Input placeholder="Ex: (11) 99999-9999" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  );
}
