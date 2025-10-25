'use client';

import { useEffect } from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Form,
  Select,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  App,
} from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { AdminClient, AccountStatus, ClientsResponse } from '@/lib/admin/types';
import { updateAccount } from '@/lib/admin/api/clients';

interface ClientDrawerProps {
  open: boolean;
  client: AdminClient | null;
  onClose: () => void;
}

const statusLabels: Record<AccountStatus, string> = {
  active: 'Ativo',
  blocked: 'Bloqueado',
  suspended: 'Suspenso',
};

export function ClientDrawer({ open, client, onClose }: ClientDrawerProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  useEffect(() => {
    if (client) {
      form.setFieldsValue({
        status: client.status,
      });
    }
  }, [client, form]);

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdminClient> }) =>
      updateAccount(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'clients'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'clients'] }, (old: ClientsResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c: AdminClient) => (c.id === id ? { ...c, ...patch } : c)),
        };
      });
    },
    onSuccess: () => {
      message.success('Conta atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      onClose();
    },
    onError: () => {
      message.error('Falha ao atualizar conta');
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });

  const handleSave = async () => {
    if (!client) return;
    try {
      const values = await form.validateFields();
      updateMutation.mutate({
        id: client.id,
        patch: {
          status: values.status,
        },
      });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (!client) return null;

  // Mock total shipments KPI
  const totalShipments = Math.floor(Math.random() * 500) + 50;

  return (
    <Drawer
      title="Detalhes da Conta"
      open={open}
      onClose={onClose}
      width={720}
      extra={
        <Space>
          <Button onClick={onClose}>Fechar</Button>
          <Button type="primary" onClick={handleSave} loading={updateMutation.isPending}>
            Salvar
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* KPIs */}
        <Row gutter={16}>
          <Col span={8}>
            <Statistic title="Total de Envios" value={totalShipments} />
          </Col>
          <Col span={8}>
            <Statistic
              title="Saldo em Carteira"
              value={client.walletBalance}
              precision={2}
              prefix="R$"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Balanço do Mês"
              value={client.creditsMonth - client.debitsMonth}
              precision={2}
              prefix="R$"
              valueStyle={{
                color: client.creditsMonth - client.debitsMonth >= 0 ? '#3f8600' : '#cf1322',
              }}
            />
          </Col>
        </Row>

        {/* Informações básicas */}
        <Descriptions title="Informações Básicas" bordered column={1}>
          <Descriptions.Item label="ID">{client.id}</Descriptions.Item>
          <Descriptions.Item label="Tipo">
            <Tag color={client.type === 'PJ' ? 'blue' : 'green'}>{client.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Documento">{client.document}</Descriptions.Item>
          <Descriptions.Item label="Nome">{client.name}</Descriptions.Item>
          <Descriptions.Item label="E-mail">{client.email}</Descriptions.Item>
          <Descriptions.Item label="Telefone">{client.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Criada em">
            {dayjs(client.createdAt).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        {/* Formulário de edição */}
        <Form form={form} layout="vertical">
          <Form.Item
            name="status"
            label="Status da Conta"
            rules={[{ required: true, message: 'Selecione o status' }]}
          >
            <Select
              options={[
                { label: statusLabels.active, value: 'active' },
                { label: statusLabels.blocked, value: 'blocked' },
                { label: statusLabels.suspended, value: 'suspended' },
              ]}
            />
          </Form.Item>
        </Form>

        {/* Informações financeiras */}
        <Descriptions title="Informações Financeiras" bordered column={1}>
          <Descriptions.Item label="Saldo em Carteira">
            {client.walletBalance.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </Descriptions.Item>
          <Descriptions.Item label="Créditos no Mês">
            {client.creditsMonth.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </Descriptions.Item>
          <Descriptions.Item label="Débitos no Mês">
            {client.debitsMonth.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </Descriptions.Item>
          <Descriptions.Item label="Balanço do Mês">
            <span
              style={{
                color: client.creditsMonth - client.debitsMonth >= 0 ? '#3f8600' : '#cf1322',
                fontWeight: 'bold',
              }}
            >
              {(client.creditsMonth - client.debitsMonth).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Drawer>
  );
}
