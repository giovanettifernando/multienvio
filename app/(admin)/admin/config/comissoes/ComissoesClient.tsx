'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  Space,
  Typography,
  Alert,
  Spin,
  Tag,
  Switch,
  Divider,
  Statistic,
  Row,
  Col,
  message,
} from 'antd';
import {
  SaveOutlined,
  PercentageOutlined,
  DollarOutlined,
  TruckOutlined,
  InboxOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface CommissionConfig {
  configured: boolean;
  id?: string;
  shippingCommissionPercent: number;
  pickupFeeCommissionPercent: number;
  isActive: boolean;
  updatedAt?: string;
  updatedById?: string;
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<CommissionConfig> {
  const res = await fetch('/api/admin/config/comissoes');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  return res.json();
}

async function saveConfig(data: {
  shippingCommissionPercent: number;
  pickupFeeCommissionPercent: number;
  isActive: boolean;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/admin/config/comissoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao salvar');
  }
  return res.json();
}

// ============================================================================
// Commission Simulator Component
// ============================================================================

function CommissionSimulator({
  shippingPercent,
  pickupPercent,
}: {
  shippingPercent: number;
  pickupPercent: number;
}) {
  const [baseShipping, setBaseShipping] = useState(50);
  const [basePickup, setBasePickup] = useState(15);

  const shippingWithCommission = baseShipping * (1 + shippingPercent / 100);
  const shippingCommission = shippingWithCommission - baseShipping;

  const pickupWithCommission = basePickup * (1 + pickupPercent / 100);
  const pickupCommission = pickupWithCommission - basePickup;

  const totalBase = baseShipping + basePickup;
  const totalWithCommission = shippingWithCommission + pickupWithCommission;
  const totalCommission = shippingCommission + pickupCommission;

  return (
    <Card
      size="small"
      title={
        <Space>
          <CalculatorOutlined />
          <span>Simulador de Comissão</span>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary">Valor base do frete:</Text>
            <InputNumber
              value={baseShipping}
              onChange={(v) => setBaseShipping(v || 0)}
              prefix="R$"
              min={0}
              style={{ width: '100%', marginTop: 4 }}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary">Taxa base de coleta:</Text>
            <InputNumber
              value={basePickup}
              onChange={(v) => setBasePickup(v || 0)}
              prefix="R$"
              min={0}
              style={{ width: '100%', marginTop: 4 }}
            />
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Frete com comissão"
              value={shippingWithCommission}
              precision={2}
              prefix="R$"
              styles={{ content: { color: '#1890ff' } }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              +R$ {shippingCommission.toFixed(2)} ({shippingPercent}%)
            </Text>
          </Col>
          <Col span={8}>
            <Statistic
              title="Coleta com comissão"
              value={pickupWithCommission}
              precision={2}
              prefix="R$"
              styles={{ content: { color: '#52c41a' } }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              +R$ {pickupCommission.toFixed(2)} ({pickupPercent}%)
            </Text>
          </Col>
          <Col span={8}>
            <Statistic
              title="Total para cliente"
              value={totalWithCommission}
              precision={2}
              prefix="R$"
              styles={{ content: { color: '#722ed1', fontWeight: 'bold' } }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Comissão: R$ {totalCommission.toFixed(2)}
            </Text>
          </Col>
        </Row>
      </Space>
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ComissoesClient() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  const [liveShippingPercent, setLiveShippingPercent] = useState(0);
  const [livePickupPercent, setLivePickupPercent] = useState(0);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'comissoes', 'config'],
    queryFn: fetchConfig,
  });

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      message.success('Configuração de comissões salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'comissoes', 'config'] });
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  // Inicializar formulário quando dados carregam
  useEffect(() => {
    if (config && !initializedRef.current) {
      form.setFieldsValue({
        shippingCommissionPercent: config.shippingCommissionPercent,
        pickupFeeCommissionPercent: config.pickupFeeCommissionPercent,
        isActive: config.isActive,
      });
      setLiveShippingPercent(config.shippingCommissionPercent);
      setLivePickupPercent(config.pickupFeeCommissionPercent);
      initializedRef.current = true;
    }
  }, [config, form]);

  const handleSubmit = (values: {
    shippingCommissionPercent: number;
    pickupFeeCommissionPercent: number;
    isActive: boolean;
  }) => {
    saveMutation.mutate(values);
  };

  const handleValuesChange = (changedValues: Partial<{
    shippingCommissionPercent: number;
    pickupFeeCommissionPercent: number;
  }>) => {
    if (changedValues.shippingCommissionPercent !== undefined) {
      setLiveShippingPercent(changedValues.shippingCommissionPercent);
    }
    if (changedValues.pickupFeeCommissionPercent !== undefined) {
      setLivePickupPercent(changedValues.pickupFeeCommissionPercent);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <PercentageOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            Comissões da Plataforma
          </Title>
          <Text type="secondary">
            Configure as comissões que serão aplicadas sobre os valores de frete e taxa de coleta.
            As comissões são transparentes para o usuário final.
          </Text>
        </div>

        {/* Status */}
        {config?.configured && (
          <Alert
            type={config.isActive ? 'success' : 'warning'}
            message={config.isActive ? 'Comissões Ativas' : 'Comissões Desativadas'}
            description={
              <Space direction="vertical" size="small">
                <Space>
                  <TruckOutlined />
                  <Text>Frete: {config.shippingCommissionPercent}%</Text>
                  <InboxOutlined style={{ marginLeft: 16 }} />
                  <Text>Coleta: {config.pickupFeeCommissionPercent}%</Text>
                </Space>
                {config.updatedAt && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Última atualização: {new Date(config.updatedAt).toLocaleString('pt-BR')}
                  </Text>
                )}
              </Space>
            }
            showIcon
          />
        )}

        {/* Info */}
        <Alert
          type="info"
          message="Como funcionam as comissões"
          description={
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
              <li>
                <strong>Comissão sobre frete:</strong> Aplicada automaticamente ao valor retornado
                pelas APIs das transportadoras em /cotacoes
              </li>
              <li>
                <strong>Comissão sobre coleta:</strong> Aplicada à taxa do coletor quando o
                cliente solicita &quot;Coleta na origem&quot;
              </li>
              <li>
                As comissões são registradas internamente em cada envio para facilitar a
                reconciliação financeira
              </li>
              <li>
                O cliente visualiza apenas o valor final (já com comissão inclusa)
              </li>
            </ul>
          }
          showIcon
        />

        {/* Formulário */}
        <Card title="Configuração de Comissões">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={handleValuesChange}
            initialValues={{
              shippingCommissionPercent: 0,
              pickupFeeCommissionPercent: 0,
              isActive: true,
            }}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="shippingCommissionPercent"
                  label={
                    <Space>
                      <TruckOutlined />
                      <span>Comissão sobre Frete</span>
                    </Space>
                  }
                  rules={[
                    { required: true, message: 'Informe a comissão' },
                    { type: 'number', min: 0, max: 100, message: 'Deve ser entre 0 e 100%' },
                  ]}
                  extra="Percentual aplicado sobre o valor base do frete"
                >
                  <InputNumber
                    min={0}
                    max={100}
                    precision={2}
                    step={0.5}
                    addonAfter="%"
                    size="large"
                    style={{ width: '100%' }}
                    placeholder="Ex: 10"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="pickupFeeCommissionPercent"
                  label={
                    <Space>
                      <InboxOutlined />
                      <span>Comissão sobre Taxa de Coleta</span>
                    </Space>
                  }
                  rules={[
                    { required: true, message: 'Informe a comissão' },
                    { type: 'number', min: 0, max: 100, message: 'Deve ser entre 0 e 100%' },
                  ]}
                  extra="Percentual aplicado sobre a taxa de coleta do coletor"
                >
                  <InputNumber
                    min={0}
                    max={100}
                    precision={2}
                    step={0.5}
                    addonAfter="%"
                    size="large"
                    style={{ width: '100%' }}
                    placeholder="Ex: 5"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="isActive"
              label="Status"
              valuePropName="checked"
              extra="Quando desativado, nenhuma comissão será aplicada aos valores"
            >
              <Switch
                checkedChildren="Ativo"
                unCheckedChildren="Inativo"
              />
            </Form.Item>

            <Divider />

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saveMutation.isPending}
                size="large"
              >
                Salvar Configuração
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Simulador */}
        <CommissionSimulator
          shippingPercent={liveShippingPercent}
          pickupPercent={livePickupPercent}
        />
      </Space>
    </div>
  );
}
