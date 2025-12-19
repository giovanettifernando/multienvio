'use client';

import { useState, useEffect } from 'react';
import { ELTable, ELTag, ELSpace, ELSpin, useELApp, ELForm, ELButton, ELCard, ELDatePicker, ELInput, ELModal, ELEmpty } from '@/shared/ui';
import type { TableProps } from '@/shared/ui/antd-types';
const Table = ELTable;
const Tag = ELTag;
const Space = ELSpace;
const Spin = ELSpin;
const App = { useApp: useELApp };
const Form = ELForm;
import { EnvironmentOutlined, InboxOutlined, CameraOutlined, CheckCircleOutlined, PhoneOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

import dayjs, { Dayjs } from 'dayjs';
import { PageShell } from '@/shared/ui/PageShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Card, Button, Input, DatePicker } = { Card: ELCard, Button: ELButton, Input: ELInput, DatePicker: ELDatePicker };

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

interface AttemptNote {
  attemptNumber: number;
  attemptedAt: string;
  notes: string | null;
  collectorId: string;
  collectorName: string;
}

interface PickupRequest {
  id: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  status: string;
  createdAt: string;
  scheduleAt: string | null;
  attemptCount: number;
  attemptNotes: AttemptNote[] | null;
  shipment: {
    trackingCode: string;
    weight: number;
    declaredValue: number;
    recipientName: string | null;
    destinationCity: string;
    destinationState: string;
    originCep: string;
  };
  user: {
    name: string;
    phone: string | null;
  };
  senderAddress: SenderAddress | null;
}

interface PickupsResponse {
  items: PickupRequest[];
  page: number;
  pageSize: number;
  total: number;
}

interface RegisterCollectionData {
  scannedCode: string;
  collectedBy: string;
}

interface RegisterAttemptData {
  notes?: string;
}

interface SchedulePickupData {
  scheduleAt: string;
}

async function fetchPickups(page: number, pageSize: number): Promise<PickupsResponse> {
  const response = await fetch(`/api/coletores/coletas?page=${page}&pageSize=${pageSize}`);
  if (!response.ok) {
    throw new Error('Erro ao carregar coletas');
  }
  return response.json();
}

async function registerCollection(pickupId: string, data: RegisterCollectionData): Promise<void> {
  const response = await fetch(`/api/coletores/coletas/${pickupId}/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao registrar coleta');
  }
}

async function registerAttempt(pickupId: string, data: RegisterAttemptData): Promise<void> {
  const response = await fetch(`/api/coletores/coletas/${pickupId}/registrar-tentativa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao registrar tentativa');
  }
}

async function schedulePickup(pickupId: string, data: SchedulePickupData): Promise<void> {
  const response = await fetch(`/api/coletores/coletas/${pickupId}/agendar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao agendar coleta');
  }
}

/**
 * Calcula os limites de data/hora para agendamento de coleta
 */
function getScheduleLimits(createdAt: string): {
  minDate: Dayjs;
  maxDate: Dayjs;
  isOverdue: boolean;
} {
  const now = dayjs();
  const created = dayjs(createdAt);
  const threeDaysAfterCreation = created.add(3, 'days');

  const isOverdue = now.isAfter(threeDaysAfterCreation);

  if (isOverdue) {
    // Coleta atrasada: entre agora e agora + 1 dia
    return {
      minDate: now,
      maxDate: now.add(1, 'day'),
      isOverdue: true,
    };
  } else {
    // Dentro do prazo: entre createdAt e createdAt + 3 dias
    return {
      minDate: created,
      maxDate: threeDaysAfterCreation,
      isOverdue: false,
    };
  }
}

/**
 * Verifica se uma data está dentro dos limites permitidos
 */
function disabledDate(current: Dayjs, createdAt: string): boolean {
  if (!current) return false;

  const limits = getScheduleLimits(createdAt);
  return current.isBefore(limits.minDate, 'day') || current.isAfter(limits.maxDate, 'day');
}

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    COLLECTED: 'Entregar para transportadora',
    COMPLETED: 'Concluída',
    FAILED: 'Falhou',
    CANCELED: 'Cancelada',
  };
  return statusMap[status] || status;
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    PENDING: 'orange',
    SCHEDULED: 'blue',
    COLLECTED: 'processing',
    COMPLETED: 'green',
    FAILED: 'red',
    CANCELED: 'default',
  };
  return colorMap[status] || 'default';
}

function buildPickupAddress(pickup: PickupRequest): {
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

interface RegisterCollectionModalProps {
  pickup: PickupRequest | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterCollectionModal({ pickup, open, onClose, onSuccess }: RegisterCollectionModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [scanning, setScanning] = useState(false);
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (data: RegisterCollectionData) => {
      if (!pickup) throw new Error('Nenhuma coleta selecionada');
      return registerCollection(pickup.id, data);
    },
    onSuccess: () => {
      message.success('Coleta registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['collector-pickups'] });
      form.resetFields();
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });

  const handleSubmit = async (values: RegisterCollectionData) => {
    registerMutation.mutate(values);
  };

  const handleScanBarcode = async () => {
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const codeReader = new BrowserMultiFormatReader();

      try {
        const result = await codeReader.decodeOnceFromVideoDevice(undefined, video);
        form.setFieldsValue({ scannedCode: result.getText() });
        message.success('Código de barras lido com sucesso!');
      } catch {
        message.warning('Não foi possível ler o código. Digite manualmente.');
      } finally {
        stream.getTracks().forEach(track => track.stop());
        codeReader.reset();
      }
    } catch {
      message.error('Não foi possível acessar a câmera. Verifique as permissões.');
    } finally {
      setScanning(false);
    }
  };

  const addressInfo = pickup ? buildPickupAddress(pickup) : null;

  return (
    <ELModal
      title="Registrar Coleta"
      open={open}
      onCancel={onClose}
      footer={null}
      size="md"
    >
      {pickup && (
        <div style={{ marginBottom: 24 }}>
          <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <strong>Código:</strong> {pickup.shipment.trackingCode}
              </div>
              <div>
                <strong>Remetente:</strong> {pickup.user.name}
                {pickup.user.phone && (
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>
                    ({pickup.user.phone})
                  </span>
                )}
              </div>
              {addressInfo && (
                <div>
                  <strong>Endereço:</strong>{' '}
                  {addressInfo.fullAddress}
                </div>
              )}
            </Space>
          </Card>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Código de rastreio da plataforma"
          name="scannedCode"
          rules={[{ required: true, message: 'Código é obrigatório' }]}
        >
          <Input
            placeholder="Digite ou escaneie o código"
            size="large"
            suffix={
              <Button
                icon={<CameraOutlined />}
                onClick={handleScanBarcode}
                loading={scanning}
                type="text"
              >
                {scanning ? 'Escaneando...' : 'Escanear'}
              </Button>
            }
          />
        </Form.Item>

        <Form.Item
          label="Nome de quem entregou os volumes"
          name="collectedBy"
          rules={[{ required: true, message: 'Nome é obrigatório' }]}
        >
          <Input placeholder="Ex: João Silva" size="large" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckCircleOutlined />}
              loading={registerMutation.isPending}
            >
              Confirmar Coleta
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </ELModal>
  );
}

interface RegisterAttemptModalProps {
  pickup: PickupRequest | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterAttemptModal({ pickup, open, onClose, onSuccess }: RegisterAttemptModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const attemptMutation = useMutation({
    mutationFn: (data: RegisterAttemptData) => {
      if (!pickup) throw new Error('Nenhuma coleta selecionada');
      return registerAttempt(pickup.id, data);
    },
    onSuccess: () => {
      message.success('Tentativa de coleta registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['collector-pickups'] });
      form.resetFields();
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      message.error(error.message || 'Erro ao registrar tentativa');
    },
  });

  const handleSubmit = (values: RegisterAttemptData) => {
    attemptMutation.mutate(values);
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  if (!pickup) return null;

  const addressInfo = buildPickupAddress(pickup);

  return (
    <ELModal
      title="Registrar Tentativa de Coleta"
      open={open}
      onCancel={handleCancel}
      footer={null}
      size="md"
    >
      {/* Card de resumo */}
      <Card
        size="small"
        style={{ marginBottom: 20, backgroundColor: '#fafafa' }}
      >
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <strong>Código:</strong> {pickup.shipment.trackingCode}
          </div>
          <div>
            <strong>Remetente:</strong> {pickup.user.name}
            {pickup.user.phone && (
              <>
                {' '}-{' '}
                <a href={`tel:${pickup.user.phone}`}>{pickup.user.phone}</a>
              </>
            )}
          </div>
          {addressInfo && (
            <div>
              <strong>Endereço:</strong> {addressInfo.formatted.replace('\n', ', ')}
            </div>
          )}
        </Space>
      </Card>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Observação (opcional)"
          name="notes"
          extra="Ex: Remetente ausente, Endereço fechado, etc."
        >
          <Input.TextArea
            placeholder="Descreva o motivo da tentativa sem sucesso..."
            rows={4}
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<ExclamationCircleOutlined />}
              loading={attemptMutation.isPending}
            >
              Confirmar Tentativa
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </ELModal>
  );
}

/**
 * Card de coleta para mobile
 */
function PickupCard({
  pickup,
  onRegister,
  onRegisterAttempt,
  onScheduleChange
}: {
  pickup: PickupRequest;
  onRegister: () => void;
  onRegisterAttempt: () => void;
  onScheduleChange: (scheduleAt: string) => void;
}) {
  const addressInfo = buildPickupAddress(pickup);
  const googleMapsUrl = addressInfo ? getGoogleMapsUrl(addressInfo.fullAddress) : null;
  const limits = getScheduleLimits(pickup.createdAt);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InboxOutlined style={{ fontSize: 16, color: '#1890ff' }} />
          <strong style={{ fontSize: 15 }}>{pickup.shipment.trackingCode}</strong>
        </div>
        <Space orientation="vertical" size={0} align="end">
          <Tag color={getStatusColor(pickup.status)}>{getStatusLabel(pickup.status)}</Tag>
          {pickup.attemptCount > 0 && (
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
              {pickup.attemptCount === 1 ? '1 tentativa' : `${pickup.attemptCount} tentativas`}
            </span>
          )}
        </Space>
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

      {/* Linha 4: Peso */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>Peso</div>
        <strong style={{ fontSize: 14 }}>{pickup.shipment.weight.toFixed(2)} kg</strong>
      </div>

      {/* Linha 5: Data da Coleta */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Data da Coleta</div>
        <DatePicker
          showTime
          format="DD/MM/YYYY HH:mm"
          placeholder="Selecione data/hora"
          value={pickup.scheduleAt ? dayjs(pickup.scheduleAt) : null}
          disabledDate={(current) => disabledDate(current, pickup.createdAt)}
          onChange={(date) => {
            if (date) {
              onScheduleChange(date.toISOString());
            }
          }}
          style={{ width: '100%' }}
          status={limits.isOverdue ? 'warning' : undefined}
          size="large"
        />
      </div>

      {/* Linha 6: Botões de Ação */}
      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
        <Button
          type="primary"
          size="large"
          onClick={onRegister}
          style={{ width: '100%', minHeight: 44, fontSize: 14 }}
        >
          Registrar Coleta
        </Button>
        <Button
          size="large"
          icon={<ExclamationCircleOutlined />}
          onClick={onRegisterAttempt}
          style={{ width: '100%', minHeight: 44, fontSize: 13 }}
        >
          Registrar Tentativa
        </Button>
      </Space>
    </Card>
  );
}

export default function ColetasColetorClient() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<PickupRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [attemptModalOpen, setAttemptModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['collector-pickups', page, pageSize],
    queryFn: () => fetchPickups(page, pageSize),
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (error) {
      message.error('Erro ao carregar coletas');
    }
  }, [error, message]);

  const handleRegisterClick = (pickup: PickupRequest) => {
    setSelectedPickup(pickup);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPickup(null);
  };

  const handleRegisterAttemptClick = (pickup: PickupRequest) => {
    setSelectedPickup(pickup);
    setAttemptModalOpen(true);
  };

  const handleAttemptModalClose = () => {
    setAttemptModalOpen(false);
    setSelectedPickup(null);
  };

  const handleScheduleChange = async (pickupId: string, scheduleAt: string) => {
    try {
      await schedulePickup(pickupId, { scheduleAt });
      message.success('Data da coleta atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['collector-pickups'] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao agendar coleta';
      message.error(errorMessage);
    }
  };

  const columns: TableProps<PickupRequest>['columns'] = [
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
      render: (_, record: PickupRequest) => (
        <Space orientation="vertical" size={0} style={{ width: '100%' }}>
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
      render: (_, record: PickupRequest) => {
        const addressInfo = buildPickupAddress(record);

        if (!addressInfo) {
          return (
            <Space orientation="vertical" size={0}>
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
            <Space orientation="vertical" size={0}>
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
      title: 'Data da Coleta',
      key: 'scheduleAt',
      width: 200,
      render: (_, record: PickupRequest) => {
        const limits = getScheduleLimits(record.createdAt);

        return (
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            placeholder="Selecione data/hora"
            value={record.scheduleAt ? dayjs(record.scheduleAt) : null}
            disabledDate={(current) => disabledDate(current, record.createdAt)}
            onChange={(date) => {
              if (date) {
                handleScheduleChange(record.id, date.toISOString());
              }
            }}
            style={{ width: '100%' }}
            status={limits.isOverdue ? 'warning' : undefined}
          />
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string, record: PickupRequest) => (
        <Space orientation="vertical" size={0}>
          <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
          {record.attemptCount > 0 && (
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
              {record.attemptCount === 1 ? '1 tentativa' : `${record.attemptCount} tentativas`} de coleta
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record: PickupRequest) => (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="middle"
            onClick={() => handleRegisterClick(record)}
            style={{
              width: '100%',
              minHeight: '40px',
              fontSize: '14px'
            }}
          >
            Registrar
          </Button>
          <Button
            size="middle"
            icon={<ExclamationCircleOutlined />}
            onClick={() => handleRegisterAttemptClick(record)}
            style={{
              width: '100%',
              minHeight: '40px',
              fontSize: '13px'
            }}
          >
            Registrar tentativa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageShell title="Fila de Coletas" gap="md">
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Carregando coletas...</p>
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <ELEmpty
            message="Nenhuma coleta pendente"
            description="Você não tem coletas pendentes no momento."
          />
        </Card>
      ) : (
        <>
          {/* Layout Mobile: Cards empilhados */}
          {isMobile ? (
            <div>
              {data.items.map((pickup) => (
                <PickupCard
                  key={pickup.id}
                  pickup={pickup}
                  onRegister={() => handleRegisterClick(pickup)}
                  onRegisterAttempt={() => handleRegisterAttemptClick(pickup)}
                  onScheduleChange={(scheduleAt) => handleScheduleChange(pickup.id, scheduleAt)}
                />
              ))}
              {/* Paginação Mobile */}
              {data.total > pageSize && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Space orientation="vertical" size="middle">
                    <div style={{ fontSize: 14, color: '#8c8c8c' }}>
                      Página {page} de {Math.ceil(data.total / pageSize)} • Total: {data.total} coletas
                    </div>
                    <Space>
                      <Button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        size="large"
                      >
                        Anterior
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= Math.ceil(data.total / pageSize)}
                        size="large"
                      >
                        Próxima
                      </Button>
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
                pagination={{
                  current: page,
                  pageSize,
                  total: data.total,
                  onChange: setPage,
                  showTotal: (total) => `Total: ${total} coletas`,
                  responsive: true,
                  showSizeChanger: false,
                }}
                scroll={{ x: 1200, y: 'calc(100vh - 400px)' }}
                size="middle"
              />
            </Card>
          )}
        </>
      )}

      <RegisterCollectionModal
        pickup={selectedPickup}
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={() => {}}
      />

      <RegisterAttemptModal
        pickup={selectedPickup}
        open={attemptModalOpen}
        onClose={handleAttemptModalClose}
        onSuccess={() => {}}
      />
    </PageShell>
  );
}
