'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Button, Tooltip, Space, App } from 'antd';
import { ReloadOutlined, CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingPayment {
  id: string;
  externalId: string | null;
  referenceId: string;
  amountCents: number;
  method: string;
  status: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  } | null;
}

export default function PendingPaymentsGrid() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-transactions/pending', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar pagamentos');

      const json = await res.json();
      const data = json.data ?? json;
      setPayments(data.payments || []);
    } catch {
      message.error('Erro ao carregar pagamentos pendentes');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleSync = async (externalId: string) => {
    setRefreshing(externalId);
    try {
      const res = await fetch('/api/admin/payment-transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ externalId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao sincronizar');
      }

      message.success('Pagamento sincronizado com sucesso!');
      loadPayments(); // Recarregar lista
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao sincronizar pagamento');
    } finally {
      setRefreshing(null);
    }
  };

  const handleForceApprove = async (paymentId: string) => {
    setRefreshing(paymentId);
    try {
      const res = await fetch(`/api/admin/payment-transactions/${paymentId}/force-approve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao aprovar');
      }

      message.success('Pagamento aprovado e carteira creditada!');
      loadPayments(); // Recarregar lista
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao aprovar pagamento');
    } finally {
      setRefreshing(null);
    }
  };

  const columns: TableProps<PendingPayment>['columns'] = [
    {
      title: 'Cliente',
      dataIndex: 'user',
      key: 'user',
      render: (user) =>
        user ? (
          <div>
            <div style={{ fontWeight: 500 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{user.email}</div>
          </div>
        ) : (
          <span style={{ color: '#999' }}>Sem usuário</span>
        ),
    },
    {
      title: 'Valor',
      dataIndex: 'amountCents',
      key: 'amountCents',
      render: (cents) => (
        <span style={{ fontWeight: 500 }}>
          R$ {(cents / 100).toFixed(2)}
        </span>
      ),
      width: 120,
    },
    {
      title: 'Método',
      dataIndex: 'method',
      key: 'method',
      render: (method) => {
        const colors: Record<string, string> = {
          CREDIT_CARD: 'blue',
          PIX: 'green',
          BOLETO: 'orange',
        };
        return <Tag color={colors[method] || 'default'}>{method}</Tag>;
      },
      width: 140,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors: Record<string, string> = {
          PENDING: 'orange',
          PAID: 'green',
          FAILED: 'red',
          CANCELED: 'default',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
      width: 120,
    },
    {
      title: 'Criado há',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Tooltip title={new Date(date).toLocaleString('pt-BR')}>
          {formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })}
        </Tooltip>
      ),
      width: 150,
    },
    {
      title: 'MP Payment ID',
      dataIndex: 'externalId',
      key: 'externalId',
      render: (id) =>
        id ? (
          <code style={{ fontSize: 12, background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>
            {id}
          </code>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
      width: 150,
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {record.externalId && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleSync(record.externalId!)}
              loading={refreshing === record.externalId}
            >
              Sincronizar
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleForceApprove(record.id)}
            loading={refreshing === record.id}
            danger
          >
            Forçar Aprovação
          </Button>
        </Space>
      ),
      width: 240,
    },
  ];

  return (
    <Card
      title="Aprovações Pendentes"
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={loadPayments}
          loading={loading}
        >
          Atualizar
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={payments}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total} pagamento(s)`,
        }}
        locale={{
          emptyText: 'Nenhum pagamento pendente',
        }}
      />
    </Card>
  );
}
