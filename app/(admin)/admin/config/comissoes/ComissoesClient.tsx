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
  InboxOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/lib/utils/format';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface CommissionConfig {
  configured: boolean;
  id?: string;
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
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: {
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
  const json = await res.json();
  return json.data ?? json;
}

// ============================================================================
// Commission Simulator Component
// ============================================================================

function CommissionSimulator({
  pickupPercent,
}: {
  pickupPercent: number;
}) {
  const [basePickup, setBasePickup] = useState(15);

  const pickupWithCommission = basePickup * (1 + pickupPercent / 100);
  const pickupCommission = pickupWithCommission - basePickup;

  return (
    <Card
      size="small"
      title={
        <Space>
          <CalculatorOutlined />
          <span>Simulador de Comissão sobre Coleta</span>
        </Space>
      }
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary">Taxa base de coleta:</Text>
            <InputNumber
              value={basePickup}
              onChange={(v) => setBasePickup(v || 0)}
              prefix="R$"
              min={0}
              precision={2}
              decimalSeparator=","
              formatter={inputNumberFormatterBRL}
              parser={inputNumberParserBRL}
              style={{ width: '100%', marginTop: 4 }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="Valor para cliente"
              value={pickupWithCommission}
              precision={2}
              prefix="R$"
              styles={{ content: { color: '#52c41a' } }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              +R$ {pickupCommission.toFixed(2)} de comissão ({pickupPercent}%)
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
        pickupFeeCommissionPercent: config.pickupFeeCommissionPercent,
        isActive: config.isActive,
      });
      setLivePickupPercent(config.pickupFeeCommissionPercent);
      initializedRef.current = true;
    }
  }, [config, form]);

  const handleSubmit = (values: {
    pickupFeeCommissionPercent: number;
    isActive: boolean;
  }) => {
    saveMutation.mutate(values);
  };

  const handleValuesChange = (changedValues: Partial<{
    pickupFeeCommissionPercent: number;
  }>) => {
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
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <PercentageOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            Comissão sobre Coleta
          </Title>
          <Text type="secondary">
            Configure a comissão que será aplicada sobre a taxa de coleta.
            A comissão sobre frete é configurada individualmente por transportadora.
          </Text>
        </div>

        {/* Status */}
        {config?.configured && (
          <Alert
            type={config.isActive ? 'success' : 'warning'}
            title={config.isActive ? 'Comissões Ativas' : 'Comissões Desativadas'}
            description={
              <Space orientation="vertical" size="small">
                <Space>
                  <InboxOutlined />
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
          title="Como funciona a comissão sobre coleta"
          description={
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
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
              <li>
                <strong>Nota:</strong> A comissão sobre frete é configurada individualmente por
                transportadora (ex: em Admin &gt; Correios)
              </li>
            </ul>
          }
          showIcon
        />

        {/* Formulário */}
        <Card title="Configuração de Comissão sobre Coleta">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={handleValuesChange}
            initialValues={{
              pickupFeeCommissionPercent: 0,
              isActive: true,
            }}
          >
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
              style={{ maxWidth: 400 }}
            >
              <InputNumber
                min={0}
                max={100}
                precision={2}
                step={0.5}
                suffix="%"
                size="large"
                style={{ width: '100%' }}
                placeholder="Ex: 5"
              />
            </Form.Item>

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
          pickupPercent={livePickupPercent}
        />
      </Space>
    </div>
  );
}
