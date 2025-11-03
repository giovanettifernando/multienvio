'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Input,
  Radio,
  App,
  Typography,
} from 'antd';
import { CheckOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { TextArea } = Input;

interface Reception {
  id: string;
  trackingCode: string;
  senderName: string;
  recipientName: string;
  weight?: number | null;
  declaredValue?: number | null;
  status: string;
  expectedAt?: string | null;
  receivedAt?: string | null;
  issueType?: string | null;
  issueDetails?: string | null;
  commissionReais: number;
  createdAt: string;
}

interface ReceptionListResponse {
  items: Reception[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

const issueTypeLabels: Record<string, string> = {
  damaged: 'Danificado',
  incomplete: 'Incompleto',
  wrong_address: 'Endereço Errado',
  other: 'Outro',
};

export default function ReceptionsPage() {
  const { message } = App.useApp();
  const [data, setData] = useState<ReceptionListResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReception, setSelectedReception] = useState<Reception | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          status: statusFilter,
          page: page.toString(),
          pageSize: data.pageSize.toString(),
        });

        const response = await fetch(`/api/collector/receptions?${params}`);

        if (!response.ok) {
          throw new Error('Erro ao carregar recepções');
        }

        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Receptions error:', error);
        message.error('Erro ao carregar recepções');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, data.pageSize, message]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReceive = (reception: Reception) => {
    setSelectedReception(reception);
    form.resetFields();
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (!selectedReception) return;

      const response = await fetch(
        `/api/collector/receptions/${selectedReception.id}/receive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao processar recepção');
      }

      message.success('Recepção processada com sucesso');
      setModalOpen(false);
      setSelectedReception(null);
      await loadData(data.page);
    } catch (error) {
      console.error('Receive error:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao processar recepção');
    }
  };

  const columns: ColumnsType<Reception> = [
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
      title: 'Destinatário',
      dataIndex: 'recipientName',
      key: 'recipientName',
    },
    {
      title: 'Peso (kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (weight) => weight?.toFixed(2) || '-',
    },
    {
      title: 'Comissão',
      dataIndex: 'commissionReais',
      key: 'commissionReais',
      width: 100,
      render: (value) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value),
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
      title: 'Ações',
      key: 'actions',
      width: 120,
      render: (_, record) =>
        record.status === 'PENDING' ? (
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleReceive(record)}
          >
            Receber
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Fila de Recepções
        </Title>
        <Space>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              loadData(1);
            }}
            style={{ width: 180 }}
          >
            <Select.Option value="all">Todos</Select.Option>
            <Select.Option value="PENDING">Aguardando</Select.Option>
            <Select.Option value="RECEIVED">Recebidos</Select.Option>
            <Select.Option value="ISSUE_REPORTED">Com Problema</Select.Option>
            <Select.Option value="PROCESSED">Processados</Select.Option>
          </Select>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data.items}
          rowKey="id"
          loading={loading}
          pagination={{
            current: data.page,
            pageSize: data.pageSize,
            total: data.total,
            onChange: loadData,
            showSizeChanger: false,
            showTotal: (total) => `Total: ${total} recepções`,
          }}
        />
      </Card>

      <Modal
        title="Confirmar Recebimento"
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setModalOpen(false);
          setSelectedReception(null);
        }}
        width={600}
        okText="Confirmar"
        cancelText="Cancelar"
      >
        {selectedReception && (
          <div style={{ marginBottom: 16 }}>
            <p>
              <strong>Código:</strong> {selectedReception.trackingCode}
            </p>
            <p>
              <strong>Remetente:</strong> {selectedReception.senderName}
            </p>
            <p>
              <strong>Destinatário:</strong> {selectedReception.recipientName}
            </p>
          </div>
        )}

        <Form form={form} layout="vertical" initialValues={{ hasIssue: false }}>
          <Form.Item
            name="hasIssue"
            label="O item foi recebido com algum problema?"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value={false}>
                <CheckOutlined /> Não, recebido corretamente
              </Radio>
              <Radio value={true}>
                <WarningOutlined /> Sim, reportar problema
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.hasIssue !== curr.hasIssue}>
            {({ getFieldValue }) =>
              getFieldValue('hasIssue') ? (
                <>
                  <Form.Item
                    name="issueType"
                    label="Tipo de Problema"
                    rules={[{ required: true, message: 'Selecione o tipo de problema' }]}
                  >
                    <Select placeholder="Selecione">
                      {Object.entries(issueTypeLabels).map(([key, label]) => (
                        <Select.Option key={key} value={key}>
                          {label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="issueDetails"
                    label="Detalhes do Problema"
                    rules={[
                      {
                        required: true,
                        message: 'Descreva o problema encontrado',
                      },
                    ]}
                  >
                    <TextArea rows={4} placeholder="Descreva o problema em detalhes..." />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
