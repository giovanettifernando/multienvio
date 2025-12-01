'use client';

import { useState, useEffect } from 'react';
import { Card, Empty, Table, Tag, Space, Spin, App, DatePicker, Input, Row, Col, Typography, Button, Modal, Form } from 'antd';
import { EnvironmentOutlined, InboxOutlined, PhoneOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { TableRowSelection } from 'antd/es/table/interface';
import dayjs, { Dayjs } from 'dayjs';
import { PageShell } from '@/components/shared/PageShell';
import { useQuery } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { Title } = Typography;

interface SenderAddress {
  id: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
}

interface CompletedPickup {
  id: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  status: string;
  derivedStatus: 'CONCLUIDA' | 'AGUARDANDO_ENTREGA';
  collectedAt: string | null;
  collectedBy: string | null;
  scannedCode: string | null;
  createdAt: string;
  updatedAt: string;
  shipment: {
    trackingCode: string;
    weight: number;
    declaredValue: number;
    recipientName: string | null;
    destinationCity: string;
    destinationState: string;
    originCep: string;
    pickupFee: number | null;
  };
  user: {
    name: string;
    phone: string | null;
  };
  senderAddress: SenderAddress | null;
}

interface CompletedPickupsResponse {
  items: CompletedPickup[];
  page: number;
  pageSize: number;
  total: number;
}

async function fetchCompletedPickups(
  page: number,
  pageSize: number,
  search: string,
  dateFrom: string | null,
  dateTo: string | null
): Promise<CompletedPickupsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (search) {
    params.set('search', search);
  }

  if (dateFrom) {
    params.set('dateFrom', dateFrom);
  }

  if (dateTo) {
    params.set('dateTo', dateTo);
  }

  const response = await fetch(`/api/coletores/coletas-realizadas?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Erro ao carregar coletas realizadas');
  }
  return response.json();
}

function getStatusLabel(derivedStatus: string): string {
  const statusMap: Record<string, string> = {
    CONCLUIDA: 'Concluída',
    AGUARDANDO_ENTREGA: 'Aguardando entrega na transportadora',
  };
  return statusMap[derivedStatus] || derivedStatus;
}

function getStatusColor(derivedStatus: string): string {
  const colorMap: Record<string, string> = {
    CONCLUIDA: 'green',
    AGUARDANDO_ENTREGA: 'orange',
  };
  return colorMap[derivedStatus] || 'default';
}

function buildPickupAddress(pickup: CompletedPickup): {
  formatted: string;
  fullAddress: string;
} | null {
  if (pickup.originAddress && pickup.originCity && pickup.originUf) {
    const fullAddress = `${pickup.originAddress}, ${pickup.originCity} - ${pickup.originUf}, ${pickup.originCep}`;
    return {
      formatted: `${pickup.originAddress}\n${pickup.originCity}/${pickup.originUf}`,
      fullAddress,
    };
  }

  if (pickup.senderAddress) {
    const addr = pickup.senderAddress;
    const street = `${addr.logradouro}, ${addr.numero}`;
    const complement = addr.complemento ? ` - ${addr.complemento}` : '';
    const neighborhood = addr.bairro ? ` - ${addr.bairro}` : '';

    const line1 = `${street}${complement}${neighborhood}`;
    const line2 = `${addr.cidade}/${addr.uf}`;
    const fullAddress = `${street}${complement}${neighborhood}, ${addr.cidade} - ${addr.uf}, ${addr.cep}`;

    return {
      formatted: `${line1}\n${line2}`,
      fullAddress,
    };
  }

  return null;
}

function getGoogleMapsUrl(fullAddress: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

/**
 * Card de coleta para mobile
 */
function CompletedPickupCard({ pickup }: { pickup: CompletedPickup }) {
  const addressInfo = buildPickupAddress(pickup);
  const googleMapsUrl = addressInfo ? getGoogleMapsUrl(addressInfo.fullAddress) : null;

  return (
    <Card
      style={{
        marginBottom: 16,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      styles={{ body: { padding: 16 } }}
    >
      {/* Linha 1: Código e Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InboxOutlined style={{ fontSize: 16, color: '#1890ff' }} />
          <strong style={{ fontSize: 15 }}>{pickup.shipment.trackingCode}</strong>
        </div>
        <Tag color={getStatusColor(pickup.derivedStatus)}>{getStatusLabel(pickup.derivedStatus)}</Tag>
      </div>

      {/* Linha 2: Remetente */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Remetente</div>
        <strong style={{ fontSize: 14, display: 'block' }}>{pickup.user.name}</strong>
        {pickup.user.phone && (
          <a href={`tel:${pickup.user.phone}`} style={{ fontSize: 14, color: '#1890ff', textDecoration: 'none' }}>
            <PhoneOutlined style={{ marginRight: 4 }} />
            {pickup.user.phone}
          </a>
        )}
      </div>

      {/* Linha 3: Endereço de Coleta */}
      {addressInfo && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Endereço de Coleta</div>
          <a
            href={googleMapsUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, color: '#1890ff', textDecoration: 'none' }}
          >
            <EnvironmentOutlined style={{ marginRight: 4 }} />
            <span style={{ textDecoration: 'underline' }}>
              {addressInfo.formatted.split('\n')[0]}
            </span>
            <br />
            <span style={{ marginLeft: 20, fontSize: 12, color: '#8c8c8c' }}>
              {addressInfo.formatted.split('\n')[1]}
            </span>
          </a>
        </div>
      )}

      {/* Linha 4: Peso e Valor Declarado */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>Peso</div>
          <strong style={{ fontSize: 14 }}>{pickup.shipment.weight.toFixed(2)} kg</strong>
        </Col>
        <Col span={12}>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>Valor Declarado</div>
          <strong style={{ fontSize: 14 }}>
            {pickup.shipment.declaredValue
              ? `R$ ${pickup.shipment.declaredValue.toFixed(2)}`
              : 'N/A'}
          </strong>
        </Col>
      </Row>

      {/* Linha 5: Data da Coleta */}
      <div>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Data da Coleta</div>
        <strong style={{ fontSize: 14 }}>
          {pickup.collectedAt
            ? dayjs(pickup.collectedAt).format('DD/MM/YYYY HH:mm')
            : 'N/A'}
        </strong>
      </div>
    </Card>
  );
}

export default function ColetasRealizadasClient() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Input controlado
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form] = Form.useForm();
  const pageSize = 20;

  // Detectar mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Converter dateRange para strings ISO
  const dateFrom = dateRange?.[0] ? dateRange[0].startOf('day').toISOString() : null;
  const dateTo = dateRange?.[1] ? dateRange[1].endOf('day').toISOString() : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['completed-pickups', page, pageSize, search, dateFrom, dateTo],
    queryFn: () => fetchCompletedPickups(page, pageSize, search, dateFrom, dateTo),
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (error) {
      message.error('Erro ao carregar coletas realizadas');
    }
  }, [error, message]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1); // Resetar para página 1 ao buscar
  };

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates);
    setPage(1); // Resetar para página 1 ao mudar período
  };

  const handleOpenModal = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Selecione pelo menos uma coleta para registrar a entrega');
      return;
    }

    // Verificar se todas as coletas selecionadas estão com status AGUARDANDO_ENTREGA
    const selectedPickups = data?.items.filter((item) => selectedRowKeys.includes(item.id)) ?? [];
    const invalidPickup = selectedPickups.find((p) => p.derivedStatus !== 'AGUARDANDO_ENTREGA');

    if (invalidPickup) {
      message.error(`A coleta ${invalidPickup.shipment.trackingCode} não está aguardando entrega na transportadora`);
      return;
    }

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmitDelivery = async (values: { carrierRecipient: string; carrierUnit: string }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/coletores/coletas-realizadas/entregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupIds: selectedRowKeys,
          carrierRecipient: values.carrierRecipient,
          carrierUnit: values.carrierUnit,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao registrar entrega');
      }

      const result = await response.json();
      message.success(result.message || 'Entrega registrada com sucesso!');

      // Limpar seleção e fechar modal
      setSelectedRowKeys([]);
      handleCloseModal();

      // Recarregar dados
      window.location.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao registrar entrega');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rowSelection: TableRowSelection<CompletedPickup> = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: record.derivedStatus !== 'AGUARDANDO_ENTREGA',
    }),
  };

  const columns: ColumnsType<CompletedPickup> = [
    {
      title: 'Código',
      dataIndex: ['shipment', 'trackingCode'],
      key: 'trackingCode',
      width: 180,
      render: (trackingCode: string) => (
        <strong>{trackingCode}</strong>
      ),
    },
    {
      title: 'Remetente',
      key: 'sender',
      width: 200,
      render: (_, record: CompletedPickup) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <strong style={{ fontSize: '14px' }}>{record.user.name}</strong>
          {record.user.phone && (
            <a
              href={`tel:${record.user.phone}`}
              style={{
                fontSize: '14px',
                color: '#1890ff',
                textDecoration: 'none'
              }}
            >
              {record.user.phone}
            </a>
          )}
        </Space>
      ),
    },
    {
      title: 'Endereço de Coleta',
      key: 'origin',
      width: 300,
      render: (_, record: CompletedPickup) => {
        const addressInfo = buildPickupAddress(record);

        if (!addressInfo) {
          return (
            <Space direction="vertical" size={0}>
              <Space>
                <EnvironmentOutlined />
                <span style={{ color: '#8c8c8c' }}>Endereço não informado</span>
              </Space>
            </Space>
          );
        }

        const googleMapsUrl = getGoogleMapsUrl(addressInfo.fullAddress);
        const [line1, line2] = addressInfo.formatted.split('\n');

        return (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <Space direction="vertical" size={0}>
              <Space>
                <EnvironmentOutlined style={{ color: '#1890ff' }} />
                <span style={{ color: '#1890ff', textDecoration: 'underline' }}>
                  {line1}
                </span>
              </Space>
              <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '20px' }}>
                {line2}
              </span>
            </Space>
          </a>
        );
      },
    },
    {
      title: 'Peso',
      dataIndex: ['shipment', 'weight'],
      key: 'weight',
      width: 100,
      render: (weight: number) => `${weight.toFixed(2)} kg`,
    },
    {
      title: 'Valor Declarado',
      dataIndex: ['shipment', 'declaredValue'],
      key: 'declaredValue',
      width: 130,
      render: (value: number) => value ? `R$ ${value.toFixed(2)}` : 'N/A',
    },
    {
      title: 'Data da Coleta',
      dataIndex: 'collectedAt',
      key: 'collectedAt',
      width: 180,
      render: (collectedAt: string | null) =>
        collectedAt ? dayjs(collectedAt).format('DD/MM/YYYY HH:mm') : 'N/A',
    },
    {
      title: 'Comissão',
      key: 'commission',
      width: 120,
      render: (_, record: CompletedPickup) => {
        // Exibir comissão apenas se status for CONCLUIDA (entregue na transportadora)
        if (record.derivedStatus === 'CONCLUIDA' && record.shipment.pickupFee) {
          return `R$ ${record.shipment.pickupFee.toFixed(2)}`;
        }
        return <span style={{ color: '#8c8c8c' }}>-</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'derivedStatus',
      key: 'derivedStatus',
      width: 200,
      render: (derivedStatus: string) => (
        <Tag color={getStatusColor(derivedStatus)}>{getStatusLabel(derivedStatus)}</Tag>
      ),
    },
  ];

  return (
    <PageShell title="Coletas realizadas" gap="md">
      {/* Filtros */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Totalizador e Botão de Entrega */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Title level={5} style={{ margin: 0 }}>
              Total: {data?.total ?? 0} coletas
            </Title>
            {!isMobile && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleOpenModal}
                disabled={selectedRowKeys.length === 0 || isLoading}
              >
                Registrar entrega na transportadora ({selectedRowKeys.length})
              </Button>
            )}
          </div>

          {/* Filtros em linha ou empilhados */}
          {isMobile ? (
            // Mobile: empilhado
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Input
                placeholder="Buscar por código ou remetente"
                prefix={<SearchOutlined />}
                size="large"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={handleSearch}
                allowClear
                style={{ width: '100%' }}
              />
              <RangePicker
                size="large"
                format="DD/MM/YYYY"
                placeholder={['Data inicial', 'Data final']}
                value={dateRange}
                onChange={handleDateRangeChange}
                style={{ width: '100%' }}
              />
            </Space>
          ) : (
            // Desktop: horizontal
            <Row gutter={16}>
              <Col flex="auto">
                <Input
                  placeholder="Buscar por código ou remetente"
                  prefix={<SearchOutlined />}
                  size="large"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onPressEnter={handleSearch}
                  allowClear
                />
              </Col>
              <Col>
                <RangePicker
                  size="large"
                  format="DD/MM/YYYY"
                  placeholder={['Data inicial', 'Data final']}
                  value={dateRange}
                  onChange={handleDateRangeChange}
                />
              </Col>
            </Row>
          )}
        </Space>
      </Card>

      {/* Conteúdo */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Carregando coletas realizadas...</p>
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <Empty
            description="Você não tem coletas realizadas no período selecionado."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <>
          {/* Layout Mobile: Cards empilhados */}
          {isMobile ? (
            <div>
              {data.items.map((pickup) => (
                <CompletedPickupCard key={pickup.id} pickup={pickup} />
              ))}
              {/* Paginação Mobile */}
              {data.total > pageSize && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Space direction="vertical" size="middle">
                    <div style={{ fontSize: 14, color: '#8c8c8c' }}>
                      Página {page} de {Math.ceil(data.total / pageSize)} • Total: {data.total} coletas
                    </div>
                    <Space>
                      <button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        style={{
                          padding: '8px 16px',
                          fontSize: 14,
                          cursor: page === 1 ? 'not-allowed' : 'pointer',
                          opacity: page === 1 ? 0.5 : 1,
                        }}
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setPage(page + 1)}
                        disabled={page >= Math.ceil(data.total / pageSize)}
                        style={{
                          padding: '8px 16px',
                          fontSize: 14,
                          cursor: page >= Math.ceil(data.total / pageSize) ? 'not-allowed' : 'pointer',
                          opacity: page >= Math.ceil(data.total / pageSize) ? 0.5 : 1,
                        }}
                      >
                        Próxima
                      </button>
                    </Space>
                  </Space>
                </div>
              )}
            </div>
          ) : (
            /* Layout Desktop: Tabela */
            <Card>
              <Table
                columns={columns}
                dataSource={data.items}
                rowKey="id"
                rowSelection={rowSelection}
                pagination={{
                  current: page,
                  pageSize,
                  total: data.total,
                  onChange: setPage,
                  showTotal: (total) => `Total: ${total} coletas`,
                  responsive: true,
                  showSizeChanger: false,
                }}
                scroll={{ x: 1300 }}
                size="middle"
              />
            </Card>
          )}
        </>
      )}

      {/* Modal de Registro de Entrega */}
      <Modal
        title="Registrar entrega na transportadora"
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitDelivery}
        >
          <p style={{ marginBottom: 16, color: '#8c8c8c' }}>
            {selectedRowKeys.length} coleta(s) selecionada(s)
          </p>

          <Form.Item
            label="Nome de quem recebeu"
            name="carrierRecipient"
            rules={[{ required: true, message: 'Por favor, informe quem recebeu' }]}
          >
            <Input placeholder="Ex: João Silva" />
          </Form.Item>

          <Form.Item
            label="Unidade da transportadora"
            name="carrierUnit"
            rules={[{ required: true, message: 'Por favor, informe a unidade' }]}
          >
            <Input placeholder="Ex: CD São Paulo - Zona Sul" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={handleCloseModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                Confirmar entrega
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
