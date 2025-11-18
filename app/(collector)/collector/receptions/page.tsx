'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Modal,
  Form,
  App,
  Tag,
  Space,
  Select,
  InputNumber,
  Descriptions,
} from 'antd';
import {
  InboxOutlined,
  CameraOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageShell } from '@/components/shared/PageShell';

const { TextArea } = Input;

interface Package {
  id: string;
  packageNumber: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  hasDivergence: boolean;
  divergenceType: string | null;
  divergenceNotes: string | null;
  divergenceWidth: number | null;
  divergenceHeight: number | null;
  divergenceLength: number | null;
  divergenceWeight: number | null;
  checkedAt: string | null;
  checkedBy: string | null;
}

interface Shipment {
  id: string;
  trackingCode: string;
  carrierTrackingCode: string | null;
  sender: {
    name: string;
    phone: string;
  };
  recipient: {
    name: string;
  };
  destination: string;
  destinationCity: string;
  destinationState: string;
  weight: number;
  status: string;
  postedAt: string | null;
  packages: Package[];
}

interface ShipmentsResponse {
  shipments: Shipment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface DivergenceFormValues {
  divergenceType: 'DIMENSAO' | 'PESO' | 'DIMENSAO_E_PESO';
  newWidth?: number;
  newHeight?: number;
  newLength?: number;
  newWeight?: number;
  notes?: string;
}

export default function ReceptionsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [divergenceForm] = Form.useForm();
  
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  
  // Modals
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [divergenceModalOpen, setDivergenceModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search,
      });

      const response = await fetch(`/api/collector/receptions?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar envios');
      }

      const data: ShipmentsResponse = await response.json();
      console.log('[RECEPTIONS] Loaded shipments:', {
        total: data.pagination.total,
        count: data.shipments.length,
        page: data.pagination.page,
      });
      setShipments(data.shipments);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('[RECEPTIONS] Error loading shipments:', error);
      message.error('Erro ao carregar envios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search]);

  const handleOpenEntryModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    form.setFieldsValue({
      trackingCode: shipment.trackingCode,
    });
    setEntryModalOpen(true);
  };

  const handleRegisterEntry = async (values: { trackingCode: string }) => {
    if (!selectedShipment) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/collector/receptions/${selectedShipment.id}/register-entry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao registrar entrada');
      }

      message.success('Entrada registrada com sucesso!');
      setEntryModalOpen(false);
      form.resetFields();
      setSelectedShipment(null);
      loadShipments();
    } catch (error) {
      console.error('Error registering entry:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao registrar entrada');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDivergenceModal = (pkg: Package) => {
    setSelectedPackage(pkg);
    divergenceForm.setFieldsValue({
      divergenceType: 'DIMENSAO_E_PESO',
    });
    setDivergenceModalOpen(true);
  };

  const handleRegisterDivergence = async (values: DivergenceFormValues) => {
    if (!selectedPackage) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/collector/receptions/volumes/${selectedPackage.id}/divergence`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao registrar divergência');
      }

      message.success('Divergência registrada com sucesso!');
      setDivergenceModalOpen(false);
      divergenceForm.resetFields();
      setSelectedPackage(null);
      loadShipments();
    } catch (error) {
      console.error('Error registering divergence:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao registrar divergência');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckPackage = async (pkg: Package) => {
    try {
      const response = await fetch(
        `/api/collector/receptions/volumes/${pkg.id}/check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao conferir volume');
      }

      message.success('Volume conferido com sucesso!');
      loadShipments();
    } catch (error) {
      console.error('Error checking package:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao conferir volume');
    }
  };

  const handleScanCode = () => {
    message.info('Funcionalidade de leitura de código em desenvolvimento');
    // TODO: Implementar leitura de código de barras via câmera
  };

  const packageColumns: ColumnsType<Package> = [
    {
      title: 'Volume',
      dataIndex: 'packageNumber',
      key: 'packageNumber',
      width: 80,
      render: (num) => `#${num}`,
    },
    {
      title: 'Dimensões (cm)',
      key: 'dimensions',
      width: 150,
      render: (_, pkg) => `${pkg.width} × ${pkg.height} × ${pkg.length}`,
    },
    {
      title: 'Peso (kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      align: 'right',
      render: (weight) => weight.toFixed(1),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, pkg) => {
        if (pkg.checkedAt) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>Conferido</Tag>;
        }
        if (pkg.hasDivergence) {
          return <Tag color="orange" icon={<WarningOutlined />}>Divergência</Tag>;
        }
        return <Tag color="default">Pendente</Tag>;
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 200,
      align: 'right',
      render: (_, pkg) => (
        <Space size="small">
          <Button
            size="small"
            icon={<WarningOutlined />}
            onClick={() => handleOpenDivergenceModal(pkg)}
            disabled={!!pkg.hasDivergence || !!pkg.checkedAt}
          >
            Divergência
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => handleCheckPackage(pkg)}
            disabled={!!pkg.checkedAt}
          >
            {pkg.checkedAt ? 'Conferido' : 'Conferir'}
          </Button>
        </Space>
      ),
    },
  ];

  const getStatusColor = (status: string): string => {
    const statusMap: Record<string, string> = {
      ready_for_posting: 'default',
      postado: 'geekblue',
      em_transito: 'blue',
      coletado: 'gold',
      aguardando_recebimento: 'orange',
      recebido: 'green',
    };
    return statusMap[status] || 'default';
  };

  const getStatusLabel = (status: string): string => {
    const labelMap: Record<string, string> = {
      ready_for_posting: 'Pronto para postagem',
      postado: 'Postado',
      em_transito: 'Em trânsito',
      coletado: 'Coletado',
      aguardando_recebimento: 'Aguardando recebimento',
      recebido: 'Recebido',
    };
    return labelMap[status] || status;
  };

  const columns: ColumnsType<Shipment> = [
    {
      title: 'Código de rastreio',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 160,
    },
    {
      title: 'Remetente',
      key: 'sender',
      render: (_, record) => (
        <span>
          {record.sender.name}
          {record.sender.phone && (
            <span style={{ color: '#888', fontSize: '0.9em', marginLeft: 4 }}>
              · {record.sender.phone}
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'Destinatário',
      key: 'recipient',
      render: (_, record) => (
        <span>
          {record.recipient.name}
          {record.destination && (
            <span style={{ color: '#888', fontSize: '0.9em', marginLeft: 4 }}>
              · {record.destination}
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'Peso Total',
      dataIndex: 'weight',
      key: 'weight',
      width: 110,
      align: 'right',
      render: (weight) => `${weight.toFixed(1)} kg`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 150,
      align: 'right',
      render: (_, record) => (
        <Button
          size="small"
          type="primary"
          icon={<InboxOutlined />}
          onClick={() => handleOpenEntryModal(record)}
        >
          Registrar
        </Button>
      ),
    },
  ];

  return (
    <PageShell title="Recepção de Envios" gap="md">
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input.Search
            placeholder="Buscar por código, remetente ou destinatário..."
            allowClear
            onSearch={setSearch}
            style={{ maxWidth: 400 }}
          />

          <Table
            columns={columns}
            dataSource={shipments}
            rowKey="id"
            loading={loading}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{
                  margin: '8px 0',
                  padding: '12px 16px',
                  backgroundColor: '#fafafa',
                  borderRadius: '4px',
                }}>
                  <div style={{
                    marginBottom: 8,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#595959',
                  }}>
                    Volumes do Envio
                  </div>
                  <Table
                    columns={packageColumns}
                    dataSource={record.packages}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    bordered={false}
                  />
                </div>
              ),
              rowExpandable: (record) => record.packages.length > 0,
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (newPage, newPageSize) => {
                setPage(newPage);
                setPageSize(newPageSize || 20);
              },
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} envios`,
            }}
          />
        </Space>
      </Card>

      {/* Modal Registrar Entrada */}
      <Modal
        title="Registrar Entrada do Envio"
        open={entryModalOpen}
        onCancel={() => {
          setEntryModalOpen(false);
          form.resetFields();
          setSelectedShipment(null);
        }}
        footer={null}
        width={600}
      >
        {selectedShipment && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Código">
                {selectedShipment.trackingCode}
              </Descriptions.Item>
              <Descriptions.Item label="Remetente">
                {selectedShipment.sender.name}
              </Descriptions.Item>
              <Descriptions.Item label="Destino">
                {selectedShipment.destination}
              </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical" onFinish={handleRegisterEntry}>
              <Form.Item
                name="trackingCode"
                label="Código de Rastreio"
                rules={[{ required: true, message: 'Código é obrigatório' }]}
              >
                <Input
                  placeholder="Digite ou escaneie o código"
                  suffix={
                    <Button
                      type="link"
                      icon={<CameraOutlined />}
                      onClick={handleScanCode}
                      size="small"
                    >
                      Ler Código
                    </Button>
                  }
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setEntryModalOpen(false)}>Cancelar</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    Confirmar Entrada
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Modal Registrar Divergência */}
      <Modal
        title="Registrar Divergência do Volume"
        open={divergenceModalOpen}
        onCancel={() => {
          setDivergenceModalOpen(false);
          divergenceForm.resetFields();
          setSelectedPackage(null);
        }}
        footer={null}
        width={600}
      >
        {selectedPackage && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Volume">#{selectedPackage.packageNumber}</Descriptions.Item>
              <Descriptions.Item label="Dimensões Registradas">
                {selectedPackage.width} x {selectedPackage.height} x {selectedPackage.length} cm
              </Descriptions.Item>
              <Descriptions.Item label="Peso Registrado">
                {selectedPackage.weight} kg
              </Descriptions.Item>
            </Descriptions>

            <Form form={divergenceForm} layout="vertical" onFinish={handleRegisterDivergence}>
              <Form.Item
                name="divergenceType"
                label="Tipo de Divergência"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: 'DIMENSAO', label: 'Dimensão' },
                    { value: 'PESO', label: 'Peso' },
                    { value: 'DIMENSAO_E_PESO', label: 'Dimensão e Peso' },
                  ]}
                />
              </Form.Item>

              <Form.Item dependencies={['divergenceType']} noStyle>
                {({ getFieldValue }) => {
                  const type = getFieldValue('divergenceType');
                  const showDimensions = type === 'DIMENSAO' || type === 'DIMENSAO_E_PESO';
                  const showWeight = type === 'PESO' || type === 'DIMENSAO_E_PESO';

                  return (
                    <>
                      {showDimensions && (
                        <>
                          <Form.Item label="Novas Dimensões (cm)">
                            <Space.Compact style={{ width: '100%' }}>
                              <Form.Item
                                name="newWidth"
                                noStyle
                                rules={[{ required: true, message: 'Obrigatório' }]}
                              >
                                <InputNumber placeholder="Largura" style={{ width: '33%' }} min={0} />
                              </Form.Item>
                              <Form.Item
                                name="newHeight"
                                noStyle
                                rules={[{ required: true, message: 'Obrigatório' }]}
                              >
                                <InputNumber placeholder="Altura" style={{ width: '33%' }} min={0} />
                              </Form.Item>
                              <Form.Item
                                name="newLength"
                                noStyle
                                rules={[{ required: true, message: 'Obrigatório' }]}
                              >
                                <InputNumber placeholder="Comprimento" style={{ width: '34%' }} min={0} />
                              </Form.Item>
                            </Space.Compact>
                          </Form.Item>
                        </>
                      )}

                      {showWeight && (
                        <Form.Item
                          name="newWeight"
                          label="Novo Peso (kg)"
                          rules={[{ required: true, message: 'Peso é obrigatório' }]}
                        >
                          <InputNumber placeholder="Peso em kg" style={{ width: '100%' }} min={0} step={0.01} />
                        </Form.Item>
                      )}
                    </>
                  );
                }}
              </Form.Item>

              <Form.Item name="notes" label="Observações">
                <TextArea rows={3} placeholder="Descreva a divergência encontrada" maxLength={500} showCount />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setDivergenceModalOpen(false)}>Cancelar</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    Salvar Divergência
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </PageShell>
  );
}
