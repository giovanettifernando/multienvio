'use client';

import { useEffect } from 'react';
import {
  App,
  Button,
  Col,
  Descriptions,
  Drawer,
  Form,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
} from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { AccountStatus, AdminClient } from '@/modules/admin/application/types';
import { updateAccount } from '@/modules/admin/application/api/clients';
import { formatBRL } from '@/shared/utils/format';

interface ClientDrawerProps {
  open: boolean;
  client: AdminClient | null;
  onClose: () => void;
  onStatusChange: (id: string, status: AccountStatus) => void;
}

const statusLabels: Record<AccountStatus, string> = {
  active: 'Ativo',
  blocked: 'Bloqueado',
  suspended: 'Suspenso',
};

export function ClientDrawer({ open, client, onClose, onStatusChange }: ClientDrawerProps) {
  const { message } = App.useApp();
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
    onSuccess: (_data, variables) => {
      message.success('Conta atualizada com sucesso');
      const nextStatus = variables.patch.status as AccountStatus | undefined;
      if (nextStatus) {
        onStatusChange(variables.id, nextStatus);
      }
      onClose();
    },
    onError: () => {
      message.error('Falha ao atualizar conta');
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

  // TODO: Substituir por dados reais quando a API estiver disponível
  const totalShipments = client.totalShipments ?? 0;
  const walletAvailable = client.walletBalance / 100;
  const creditsMonth = client.creditsMonth / 100;
  const debitsMonth = client.debitsMonth != null ? client.debitsMonth / 100 : null;
  const monthBalanceCents = client.creditsMonth - (client.debitsMonth ?? 0);
  const monthBalance = monthBalanceCents / 100;

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
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic title="Total de Envios" value={totalShipments} />
          </Col>
          <Col span={8}>
            <Statistic title="Saldo em Carteira" value={walletAvailable} precision={2} prefix="R$" />
          </Col>
          <Col span={8}>
            <Statistic
              title="Balanço do Mês"
              value={monthBalance}
              precision={2}
              prefix="R$"
              styles={{ content: {
                color: monthBalanceCents >= 0 ? '#3f8600' : '#cf1322',
              } }}
            />
          </Col>
        </Row>

        <Descriptions title="Informações Básicas" bordered column={1}>
          <Descriptions.Item label="ID">{client.id}</Descriptions.Item>
          <Descriptions.Item label="Tipo">
            <Tag color={client.type === 'PJ' ? 'blue' : 'green'}>{client.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Documento">{client.document ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Nome">{client.name}</Descriptions.Item>
          <Descriptions.Item label="E-mail">{client.email}</Descriptions.Item>
          <Descriptions.Item label="Telefone">{client.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Criada em">
            {dayjs(client.createdAt).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>

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

        <Descriptions title="Informações Financeiras" bordered column={1}>
          <Descriptions.Item label="Saldo em Carteira">
            {formatBRL(walletAvailable)}
          </Descriptions.Item>
          <Descriptions.Item label="Créditos no Mês">
            {formatBRL(creditsMonth)}
          </Descriptions.Item>
          <Descriptions.Item label="Débitos no Mês">
            {debitsMonth != null ? formatBRL(debitsMonth) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Balanço do Mês">
            <span
              style={{
                color: monthBalanceCents >= 0 ? '#3f8600' : '#cf1322',
                fontWeight: 'bold',
              }}
            >
              {formatBRL(monthBalance)}
            </span>
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Drawer>
  );
}
