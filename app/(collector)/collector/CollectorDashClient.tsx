'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, App, Spin } from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import type { TableProps } from 'antd';
import { PageShell } from '@/shared/ui/PageShell';

interface KPIData {
  pending: { value: number; label: string };
  today: { value: number; label: string };
  monthly: { value: number; change: number; label: string };
  commission: { value: number; change: number; label: string };
}

interface RecentReception {
  id: string;
  trackingCode: string;
  senderName: string;
  status: string;
  receivedAt: string | null;
  createdAt: string;
}

interface DashboardData {
  kpis: KPIData;
  recentReceptions: RecentReception[];
}

const statusColors: Record<string, string> = {
  PENDING: 'orange',
  RECEIVED: 'green',
  ISSUE_REPORTED: 'red',
  PROCESSED: 'blue',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Aguardando',
  RECEIVED: 'Recebido',
  ISSUE_REPORTED: 'Com Problema',
  PROCESSED: 'Processado',
};

export default function CollectorDashClient() {
  const { message } = App.useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const response = await fetch('/api/pontos-coleta/dashboard');

        if (!response.ok) {
          throw new Error('Erro ao carregar dashboard');
        }

        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Dashboard error:', error);
        message.error('Erro ao carregar dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [message]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return <div>Erro ao carregar dados</div>;
  }

  const columns: TableProps<RecentReception>['columns'] = [
    {
      title: 'Código',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 150,
    },
    {
      title: 'Remetente',
      dataIndex: 'senderName',
      key: 'senderName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
      ),
    },
    {
      title: 'Data',
      key: 'date',
      width: 180,
      render: (_, record) => {
        const date = record.receivedAt || record.createdAt;
        return new Date(date).toLocaleString('pt-BR');
      },
    },
  ];

  return (
    <PageShell title="Dashboard" gap="md">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={data.kpis.pending.label}
              value={data.kpis.pending.value}
              prefix={<InboxOutlined />}
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={data.kpis.today.label}
              value={data.kpis.today.value}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={data.kpis.monthly.label}
              value={data.kpis.monthly.value}
              suffix={
                data.kpis.monthly.change !== 0 && (
                  <span
                    style={{
                      fontSize: 14,
                      color: data.kpis.monthly.change > 0 ? '#52c41a' : '#f5222d',
                    }}
                  >
                    {data.kpis.monthly.change > 0 ? (
                      <RiseOutlined />
                    ) : (
                      <FallOutlined />
                    )}{' '}
                    {Math.abs(data.kpis.monthly.change)}%
                  </span>
                )
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={data.kpis.commission.label}
              value={data.kpis.commission.value}
              prefix={<DollarOutlined />}
              precision={2}
              styles={{ content: { color: '#1890ff' } }}
              suffix={
                data.kpis.commission.change !== 0 && (
                  <span
                    style={{
                      fontSize: 14,
                      color: data.kpis.commission.change > 0 ? '#52c41a' : '#f5222d',
                    }}
                  >
                    {data.kpis.commission.change > 0 ? (
                      <RiseOutlined />
                    ) : (
                      <FallOutlined />
                    )}{' '}
                    {Math.abs(data.kpis.commission.change)}%
                  </span>
                )
              }
            />
          </Card>
        </Col>
      </Row>

      <Card title="Últimas Recepções">
        <Table
          columns={columns}
          dataSource={data.recentReceptions}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
        />
      </Card>
    </PageShell>
  );
}
