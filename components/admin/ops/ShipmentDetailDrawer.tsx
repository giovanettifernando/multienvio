'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Button,
  Space,
  Tabs,
  Typography,
  Timeline,
  Spin,
  Alert,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Divider,
  DatePicker,
} from 'antd';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/lib/utils/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface PackageData {
  id: string;
  packageNumber: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  hasDivergence: boolean;
  divergenceType?: string | null;
  divergenceNotes?: string | null;
  divergenceWidth?: number | null;
  divergenceHeight?: number | null;
  divergenceLength?: number | null;
  divergenceWeight?: number | null;
  checkedAt?: string | null;
}

interface TrackingEventData {
  id: string;
  description: string;
  occurredAt: string;
  city?: string | null;
  uf?: string | null;
}

interface ShipmentDetailDrawerProps {
  open: boolean;
  shipmentId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

// Fetch shipment details
async function fetchShipmentDetails(id: string) {
  const res = await fetch(`/api/admin/ops/shipments/${id}`);
  if (!res.ok) throw new Error('Failed to fetch shipment');
  return res.json();
}

// Update shipment
async function updateShipment(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/admin/ops/shipments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update shipment');
  return res.json();
}

// Fetch collectors list
async function fetchCollectors() {
  const res = await fetch('/api/admin/ops/collectors');
  if (!res.ok) throw new Error('Failed to fetch collectors');
  return res.json();
}

// Manage pickup request (create or update)
async function managePickupRequest(shipmentId: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/admin/ops/shipments/${shipmentId}/pickup-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to manage pickup request');
  return res.json();
}

export default function ShipmentDetailDrawer({
  open,
  shipmentId,
  onClose,
  onUpdate,
}: ShipmentDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editPickupMode, setEditPickupMode] = useState(false);
  const [form] = Form.useForm();
  const [pickupForm] = Form.useForm();

  // Fetch shipment data
  const { data: shipment, isLoading } = useQuery({
    queryKey: ['admin', 'ops', 'shipments', shipmentId, 'detail'],
    queryFn: () => fetchShipmentDetails(shipmentId!),
    enabled: !!shipmentId && open,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateShipment(shipmentId!, data),
    onSuccess: () => {
      message.success('Envio atualizado com sucesso');
      setEditMode(false);
      onUpdate();
      queryClient.invalidateQueries({
        queryKey: ['admin', 'ops', 'shipments', shipmentId, 'detail'],
      });
    },
    onError: () => {
      message.error('Erro ao atualizar envio');
    },
  });

  // Fetch collectors
  const { data: collectors } = useQuery({
    queryKey: ['admin', 'ops', 'collectors'],
    queryFn: fetchCollectors,
    enabled: open,
  });

  // Manage pickup request mutation
  const pickupMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => managePickupRequest(shipmentId!, data),
    onSuccess: () => {
      message.success('Coleta salva com sucesso');
      setEditPickupMode(false);
      onUpdate();
      queryClient.invalidateQueries({
        queryKey: ['admin', 'ops', 'shipments', shipmentId, 'detail'],
      });
    },
    onError: () => {
      message.error('Erro ao salvar coleta');
    },
  });

  // Initialize form when shipment data loads
  useEffect(() => {
    if (shipment && editMode) {
      form.setFieldsValue({
        status: shipment.status,
        carrier: shipment.carrier,
        service: shipment.service,
        carrierTrackingCode: shipment.carrierTrackingCode,
        weight: shipment.weight,
        declaredValue: shipment.declaredValue,
        freightCost: shipment.freightCost,
        pickupFee: shipment.pickupFee,
        estimatedDays: shipment.estimatedDays,
        recipientName: shipment.recipientName,
        recipientPhone: shipment.recipientPhone,
        recipientEmail: shipment.recipientEmail,
        recipientDocument: shipment.recipientDocument,
        destinationAddress: shipment.destinationAddress,
        destinationNeighborhood: shipment.destinationNeighborhood,
        destinationCity: shipment.destinationCity,
        destinationState: shipment.destinationState,
        destinationCep: shipment.destinationCep,
      });
    }
  }, [shipment, editMode, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      updateMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    form.resetFields();
  };

  // Initialize pickup form when pickup edit mode is activated
  useEffect(() => {
    if (shipment?.pickupRequest && editPickupMode) {
      pickupForm.setFieldsValue({
        collectorId: shipment.pickupRequest.collectorId,
        status: shipment.pickupRequest.status,
        scheduleAt: shipment.pickupRequest.scheduleAt ? dayjs(shipment.pickupRequest.scheduleAt) : null,
        notes: shipment.pickupRequest.notes,
      });
    } else if (!shipment?.pickupRequest && editPickupMode) {
      // Initialize with default values when creating new pickup
      pickupForm.setFieldsValue({
        status: 'PENDING',
      });
    }
  }, [shipment, editPickupMode, pickupForm]);

  const handleSavePickup = async () => {
    try {
      const values = await pickupForm.validateFields();
      const data = {
        ...values,
        scheduleAt: values.scheduleAt ? values.scheduleAt.toISOString() : null,
      };
      pickupMutation.mutate(data);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancelPickup = () => {
    setEditPickupMode(false);
    pickupForm.resetFields();
  };

  if (!open || !shipmentId) return null;

  if (isLoading) {
    return (
      <Drawer
        title="Detalhes do Envio"
        placement="right"
        onClose={onClose}
        open={open}
        width={800}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Drawer>
    );
  }

  if (!shipment) {
    return (
      <Drawer
        title="Detalhes do Envio"
        placement="right"
        onClose={onClose}
        open={open}
        width={800}
      >
        <Alert
          message="Erro"
          description="Envio não encontrado"
          type="error"
          showIcon
        />
      </Drawer>
    );
  }

  const tabItems = [
    {
      key: 'info',
      label: 'Informações Gerais',
      children: (
        <div>
          {editMode ? (
            <Form form={form} layout="vertical">
              <Title level={5}>Status e Transportadora</Title>
              <Form.Item label="Status" name="status">
                <Select>
                  <Select.Option value="PICKUP_REQUESTED">Coleta Solicitada</Select.Option>
                  <Select.Option value="AWAITING_DROP_OFF_AT_POINT">Aguardando Entrega no Ponto</Select.Option>
                  <Select.Option value="RECEIVED_AT_POINT">Recebido no Ponto</Select.Option>
                  <Select.Option value="IN_TRANSIT_TO_CARRIER">Em Trânsito para Transportadora</Select.Option>
                  <Select.Option value="IN_TRANSIT_TO_CARRIER_HUB">Em Trânsito para Hub</Select.Option>
                  <Select.Option value="RECEIVED_AT_CARRIER">Recebido na Transportadora</Select.Option>
                  <Select.Option value="IN_TRANSIT">Em Trânsito</Select.Option>
                  <Select.Option value="OUT_FOR_DELIVERY">Saiu para Entrega</Select.Option>
                  <Select.Option value="DELIVERED">Entregue</Select.Option>
                  <Select.Option value="EXCEPTION">Exceção</Select.Option>
                  <Select.Option value="RETURNED">Devolvido</Select.Option>
                  <Select.Option value="CANCELED">Cancelado</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="Transportadora" name="carrier">
                <Select allowClear>
                  <Select.Option value="Correios">Correios</Select.Option>
                  <Select.Option value="Jadlog">Jadlog</Select.Option>
                  <Select.Option value="J&T">J&T</Select.Option>
                  <Select.Option value="Loggi">Loggi</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="Serviço" name="service">
                <Input />
              </Form.Item>

              <Form.Item label="Código de Rastreio da Transportadora" name="carrierTrackingCode">
                <Input />
              </Form.Item>

              <Divider />

              <Title level={5}>Peso e Valores</Title>
              <Form.Item label="Peso (kg)" name="weight">
                <InputNumber min={0} step={0.01} precision={2} decimalSeparator="," style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="Valor Declarado (R$)" name="declaredValue">
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} prefix="R$" decimalSeparator="," formatter={inputNumberFormatterBRL} parser={inputNumberParserBRL} />
              </Form.Item>

              <Form.Item label="Custo do Frete (R$)" name="freightCost">
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} prefix="R$" decimalSeparator="," formatter={inputNumberFormatterBRL} parser={inputNumberParserBRL} />
              </Form.Item>

              <Form.Item label="Taxa de Coleta (R$)" name="pickupFee">
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} prefix="R$" decimalSeparator="," formatter={inputNumberFormatterBRL} parser={inputNumberParserBRL} />
              </Form.Item>

              <Form.Item label="Prazo Estimado (dias)" name="estimatedDays">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>

              <Divider />

              <Title level={5}>Destinatário</Title>
              <Form.Item label="Nome do Destinatário" name="recipientName">
                <Input />
              </Form.Item>

              <Form.Item label="Telefone do Destinatário" name="recipientPhone">
                <Input />
              </Form.Item>

              <Form.Item label="Email do Destinatário" name="recipientEmail">
                <Input />
              </Form.Item>

              <Form.Item label="Documento do Destinatário" name="recipientDocument">
                <Input />
              </Form.Item>

              <Divider />

              <Title level={5}>Endereço de Destino</Title>
              <Form.Item label="Endereço" name="destinationAddress">
                <Input />
              </Form.Item>

              <Form.Item label="Bairro" name="destinationNeighborhood">
                <Input />
              </Form.Item>

              <Form.Item label="Cidade" name="destinationCity">
                <Input />
              </Form.Item>

              <Form.Item label="Estado" name="destinationState">
                <Input maxLength={2} />
              </Form.Item>

              <Form.Item label="CEP" name="destinationCep">
                <Input />
              </Form.Item>

              <Space style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={updateMutation.isPending}
                >
                  Salvar
                </Button>
                <Button icon={<CloseOutlined />} onClick={handleCancel}>
                  Cancelar
                </Button>
              </Space>
            </Form>
          ) : (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditMode(true)}
                >
                  Editar
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    queryClient.invalidateQueries({
                      queryKey: ['admin', 'ops', 'shipments', shipmentId, 'detail'],
                    });
                  }}
                >
                  Atualizar
                </Button>
              </Space>

              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Tracking Envio Legal">
                  <Text copyable strong>
                    {shipment.platformTrackingCode}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tracking Transportadora">
                  {shipment.carrierTrackingCode ? (
                    <Text copyable>{shipment.carrierTrackingCode}</Text>
                  ) : (
                    '—'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag>{shipment.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Transportadora">
                  {shipment.carrier || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Serviço">{shipment.service || '—'}</Descriptions.Item>
                <Descriptions.Item label="Peso">{shipment.weight.toFixed(2)} kg</Descriptions.Item>
                <Descriptions.Item label="Valor Declarado">
                  R$ {shipment.declaredValue.toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Custo do Frete">
                  {shipment.freightCost ? `R$ ${shipment.freightCost.toFixed(2)}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Taxa de Coleta">
                  {shipment.pickupFee ? `R$ ${shipment.pickupFee.toFixed(2)}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Prazo Estimado">
                  {shipment.estimatedDays ? `${shipment.estimatedDays} dias` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Criado em">
                  {dayjs(shipment.createdAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="Atualizado em">
                  {dayjs(shipment.updatedAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="Postado em">
                  {shipment.postedAt
                    ? dayjs(shipment.postedAt).format('DD/MM/YYYY HH:mm')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Recebido em">
                  {shipment.receivedAt
                    ? dayjs(shipment.receivedAt).format('DD/MM/YYYY HH:mm')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Entregue em">
                  {shipment.deliveredAt
                    ? dayjs(shipment.deliveredAt).format('DD/MM/YYYY HH:mm')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'parties',
      label: 'Remetente e Destinatário',
      children: (
        <div>
          <Title level={5}>Remetente (Cliente)</Title>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Nome">{shipment.sender?.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{shipment.sender?.email || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider />

          <Title level={5}>Destinatário</Title>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Nome">{shipment.recipientName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Telefone">
              {shipment.recipientPhone || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">{shipment.recipientEmail || '—'}</Descriptions.Item>
            <Descriptions.Item label="Documento">
              {shipment.recipientDocument || '—'}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Title level={5}>Endereço de Destino</Title>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="CEP">{shipment.destinationCep}</Descriptions.Item>
            <Descriptions.Item label="Endereço">
              {shipment.destinationAddress || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Bairro">
              {shipment.destinationNeighborhood || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Cidade">{shipment.destinationCity}</Descriptions.Item>
            <Descriptions.Item label="Estado">{shipment.destinationState}</Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'pickup',
      label: 'Coleta',
      children: (
        <div>
          {shipment.pickupRequest ? (
            <>
              {editPickupMode ? (
                <Form form={pickupForm} layout="vertical">
                  <Form.Item label="Status" name="status" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="PENDING">Pendente</Select.Option>
                      <Select.Option value="SCHEDULED">Agendada</Select.Option>
                      <Select.Option value="COLLECTED">Coletada</Select.Option>
                      <Select.Option value="COMPLETED">Completa</Select.Option>
                      <Select.Option value="FAILED">Falhou</Select.Option>
                      <Select.Option value="CANCELED">Cancelada</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Coletor" name="collectorId">
                    <Select allowClear placeholder="Selecione um coletor">
                      {collectors?.map((c: { id: string; name: string }) => (
                        <Select.Option key={c.id} value={c.id}>
                          {c.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item label="Agendar para" name="scheduleAt">
                    <DatePicker
                      showTime
                      format="DD/MM/YYYY HH:mm"
                      style={{ width: '100%' }}
                      placeholder="Selecione data e hora"
                    />
                  </Form.Item>

                  <Form.Item label="Observações" name="notes">
                    <Input.TextArea rows={3} placeholder="Observações sobre a coleta" />
                  </Form.Item>

                  <Space style={{ marginTop: 16 }}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSavePickup}
                      loading={pickupMutation.isPending}
                    >
                      Salvar
                    </Button>
                    <Button icon={<CloseOutlined />} onClick={handleCancelPickup}>
                      Cancelar
                    </Button>
                  </Space>
                </Form>
              ) : (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setEditPickupMode(true)}
                    >
                      Editar Coleta
                    </Button>
                  </Space>

                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Status">
                      <Tag>{shipment.pickupRequest.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Coletor">
                      {shipment.pickupRequest.collector?.name || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Agendado para">
                      {shipment.pickupRequest.scheduleAt
                        ? dayjs(shipment.pickupRequest.scheduleAt).format('DD/MM/YYYY HH:mm')
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Coletado em">
                      {shipment.pickupRequest.collectedAt
                        ? dayjs(shipment.pickupRequest.collectedAt).format('DD/MM/YYYY HH:mm')
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Entregue na transportadora em">
                      {shipment.pickupRequest.deliveredToCarrierAt
                        ? dayjs(shipment.pickupRequest.deliveredToCarrierAt).format(
                            'DD/MM/YYYY HH:mm'
                          )
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Recebido por">
                      {shipment.pickupRequest.carrierRecipient || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Unidade da transportadora">
                      {shipment.pickupRequest.carrierUnit || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tentativas">
                      {shipment.pickupRequest.attemptCount}
                    </Descriptions.Item>
                    <Descriptions.Item label="Observações">
                      {shipment.pickupRequest.notes || '—'}
                    </Descriptions.Item>
                  </Descriptions>
                </>
              )}
            </>
          ) : (
            <>
              {editPickupMode ? (
                <Form form={pickupForm} layout="vertical">
                  <Alert
                    message="Criar Nova Coleta"
                    description="Preencha os dados abaixo para criar uma solicitação de coleta para este envio."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />

                  <Form.Item label="Status" name="status" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="PENDING">Pendente</Select.Option>
                      <Select.Option value="SCHEDULED">Agendada</Select.Option>
                      <Select.Option value="COLLECTED">Coletada</Select.Option>
                      <Select.Option value="COMPLETED">Completa</Select.Option>
                      <Select.Option value="FAILED">Falhou</Select.Option>
                      <Select.Option value="CANCELED">Cancelada</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Coletor" name="collectorId">
                    <Select allowClear placeholder="Selecione um coletor">
                      {collectors?.map((c: { id: string; name: string }) => (
                        <Select.Option key={c.id} value={c.id}>
                          {c.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item label="Agendar para" name="scheduleAt">
                    <DatePicker
                      showTime
                      format="DD/MM/YYYY HH:mm"
                      style={{ width: '100%' }}
                      placeholder="Selecione data e hora"
                    />
                  </Form.Item>

                  <Form.Item label="Observações" name="notes">
                    <Input.TextArea rows={3} placeholder="Observações sobre a coleta" />
                  </Form.Item>

                  <Space style={{ marginTop: 16 }}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSavePickup}
                      loading={pickupMutation.isPending}
                    >
                      Criar Coleta
                    </Button>
                    <Button icon={<CloseOutlined />} onClick={handleCancelPickup}>
                      Cancelar
                    </Button>
                  </Space>
                </Form>
              ) : (
                <>
                  <Alert
                    message="Nenhuma coleta associada"
                    description="Este envio não possui uma solicitação de coleta."
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Button
                    type="primary"
                    onClick={() => setEditPickupMode(true)}
                  >
                    Criar Coleta
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'label',
      label: 'Etiqueta',
      children: (
        <div>
          {shipment.label ? (
            <>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Status">
                  <Tag>{shipment.label.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Preço">
                  R$ {(shipment.label.priceCents / 100).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Código de Rastreio">
                  {shipment.label.trackingCode || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Impressa">
                  {shipment.label.isPrinted ? (
                    <Tag color="green">Sim</Tag>
                  ) : (
                    <Tag color="orange">Não</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Impressa em">
                  {shipment.label.printedAt
                    ? dayjs(shipment.label.printedAt).format('DD/MM/YYYY HH:mm')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Arquivo">
                  {shipment.label.fileUrl ? (
                    <Button
                      type="link"
                      onClick={() => window.open(shipment.label.fileUrl, '_blank')}
                    >
                      Baixar PDF
                    </Button>
                  ) : (
                    '—'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </>
          ) : (
            <Alert
              message="Nenhuma etiqueta gerada"
              description="Este envio ainda não possui uma etiqueta."
              type="warning"
              showIcon
            />
          )}
        </div>
      ),
    },
    {
      key: 'packages',
      label: 'Volumes',
      children: (
        <div>
          {shipment.packages && shipment.packages.length > 0 ? (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {shipment.packages.map((pkg: PackageData) => (
                <div key={pkg.id}>
                  <Title level={5}>Volume {pkg.packageNumber}</Title>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Dimensões">
                      {pkg.width} x {pkg.height} x {pkg.length} cm
                    </Descriptions.Item>
                    <Descriptions.Item label="Peso">{pkg.weight} kg</Descriptions.Item>
                    <Descriptions.Item label="Divergência">
                      {pkg.hasDivergence ? (
                        <Tag color="red">Sim</Tag>
                      ) : (
                        <Tag color="green">Não</Tag>
                      )}
                    </Descriptions.Item>
                    {pkg.hasDivergence && (
                      <>
                        <Descriptions.Item label="Tipo de Divergência">
                          {pkg.divergenceType}
                        </Descriptions.Item>
                        <Descriptions.Item label="Observações">
                          {pkg.divergenceNotes || '—'}
                        </Descriptions.Item>
                        {pkg.divergenceWidth && (
                          <Descriptions.Item label="Novas Dimensões">
                            {pkg.divergenceWidth} x {pkg.divergenceHeight} x{' '}
                            {pkg.divergenceLength} cm
                          </Descriptions.Item>
                        )}
                        {pkg.divergenceWeight && (
                          <Descriptions.Item label="Novo Peso">
                            {pkg.divergenceWeight} kg
                          </Descriptions.Item>
                        )}
                      </>
                    )}
                    <Descriptions.Item label="Conferido em">
                      {pkg.checkedAt
                        ? dayjs(pkg.checkedAt).format('DD/MM/YYYY HH:mm')
                        : '—'}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ))}
            </Space>
          ) : (
            <Alert
              message="Nenhum volume cadastrado"
              description="Este envio ainda não possui volumes cadastrados."
              type="warning"
              showIcon
            />
          )}
        </div>
      ),
    },
    {
      key: 'tracking',
      label: 'Rastreamento',
      children: (
        <div>
          {shipment.trackingEvents && shipment.trackingEvents.length > 0 ? (
            <Timeline
              items={shipment.trackingEvents.map((evt: TrackingEventData) => ({
                content: (
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{evt.description}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {dayjs(evt.occurredAt).format('DD/MM/YYYY HH:mm')}
                    </div>
                    {(evt.city || evt.uf) && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        {evt.city && evt.uf ? `${evt.city}/${evt.uf}` : evt.city || evt.uf}
                      </div>
                    )}
                  </div>
                ),
                color: 'blue',
              }))}
            />
          ) : (
            <Alert
              message="Nenhum evento de rastreamento"
              description="Este envio ainda não possui eventos de rastreamento."
              type="info"
              showIcon
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <Drawer
      title={`Detalhes do Envio: ${shipment.platformTrackingCode}`}
      placement="right"
      onClose={() => {
        setEditMode(false);
        onClose();
      }}
      open={open}
      width={900}
    >
      <Tabs items={tabItems} />
    </Drawer>
  );
}
