'use client';

import { useEffect, useState } from 'react';
import { Form, Typography, Space, Flex, Row, Col } from 'antd';
import { ELCard } from '@/shared/ui/ELCard';
import { ELChoicePills } from '@/shared/ui/ELChoicePills';
import { CalculatorOutlined, ArrowRightOutlined, HomeOutlined, EditOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/shared/utils/api-fetch';
import { ELButton } from '@/shared/ui/ELButton';
import { ELInput } from '@/shared/ui/ELInput';
import { ELSelect } from '@/shared/ui/ELSelect';
import { ELModal } from '@/shared/ui/ELModal';
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELTag } from '@/shared/ui/ELTag';
import type { QuoteResultItem, QuoteCalculateResponse } from '@/shared/types/quote';
import { formatBRL } from '@/shared/utils/format';

const { Text } = Typography;

// Máscara de CEP: 00000-000
function maskCep(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, (_, a, b) => (b ? `${a}-${b}` : a));
}

// Validação de CEP: deve ter exatamente 8 dígitos
function isValidCep(cep: string): boolean {
  const digits = (cep || '').replace(/\D/g, '');
  return digits.length === 8;
}

interface QuoteResult {
  carrier: string;
  price: number;
  deliveryDays: number;
  service: string;
}

function mapApiResultToQuoteResult(item: QuoteResultItem): QuoteResult {
  return {
    carrier: item.carrier,
    price: item.preco,
    deliveryDays: item.prazoDias,
    service: item.modalidade,
  };
}

type UserAddress = {
  id: string;
  label: string;
  cep: string;
  cidade: string;
  uf: string;
  isDefault: boolean;
};

async function fetchUserAddresses(): Promise<UserAddress[]> {
  const data = await apiFetch<{ success: boolean; addresses: UserAddress[] }>("/api/account/addresses");
  return data.addresses || [];
}

type OriginMode = 'address' | 'cep';

export function QuickCalculator() {
  const [form] = Form.useForm();
  const router = useRouter();
  const [originMode, setOriginMode] = useState<OriginMode>('address');

  const addressesQuery = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: fetchUserAddresses,
    staleTime: 60_000,
  });

  const addresses = addressesQuery.data || [];
  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];

  useEffect(() => {
    if (defaultAddress && originMode === 'address') {
      const current = form.getFieldValue("originCep");
      if (!current) {
        form.setFieldsValue({ originCep: defaultAddress.cep });
      }
    }
  }, [defaultAddress, form, originMode]);

  // Limpar o campo de origem ao trocar de modo
  useEffect(() => {
    form.setFieldsValue({ originCep: originMode === 'address' && defaultAddress ? defaultAddress.cep : '' });
  }, [originMode, defaultAddress, form]);

  const addressOptions = addresses.map((addr) => ({
    label: `${addr.label} (${addr.cidade}/${addr.uf})`,
    value: addr.cep,
  }));

  const hasNoAddresses = !addressesQuery.isLoading && addresses.length === 0;
  const showCepInput = originMode === 'cep' || hasNoAddresses;

  const quoteMutation = useMutation({
    mutationFn: async (values: { originCep: string; destCep: string; weight: number; height?: number; width?: number; length?: number }) => {
      // Usar valores default para dimensões se não fornecidas
      const height = values.height || 10;
      const width = values.width || 15;
      const length = values.length || 20;

      const payload = {
        origem: { cep: values.originCep },
        destino: { cep: values.destCep },
        volumes: [
          {
            comprimentoCm: length,
            larguraCm: width,
            alturaCm: height,
            pesoKg: values.weight,
          },
        ],
        coleta: false,
        devolucao: false,
      };

      const response = await apiFetch<QuoteCalculateResponse>('/api/cotacoes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return response.results.map(mapApiResultToQuoteResult);
    },
  });

  const handleGoToQuote = () => {
    quoteMutation.reset();
    // Aplicar mesma regra do menu: bloquear se não tiver endereços
    if (hasNoAddresses) {
      router.push('/minha-conta?showOnboarding=true#addresses');
    } else {
      router.push('/cotacoes');
    }
  };

  const cardTitle = (
    <Flex align="center" gap={8}>
      <CalculatorOutlined />
      <Text strong>Calculadora</Text>
      <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>(cotação rápida)</Text>
    </Flex>
  );

  return (
    <>
      <ELCard header={{ title: cardTitle }} size="small" padding="md">
        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={(values) => quoteMutation.mutate(values)}
        >
          {/* Seletor de modo de origem */}
          {!hasNoAddresses && (
            <div style={{ marginBottom: 12 }}>
              <ELChoicePills
                value={originMode}
                onChange={setOriginMode}
                size="small"
                options={[
                  { value: 'address', label: 'Usar endereço', icon: <HomeOutlined /> },
                  { value: 'cep', label: 'Informar CEP', icon: <EditOutlined /> },
                ]}
              />
            </div>
          )}

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>CEP Origem</Text>}
                name="originCep"
                rules={[
                  { required: true, message: showCepInput ? 'Informe o CEP' : 'Selecione o endereço' },
                  ...(showCepInput ? [{
                    validator: (_: unknown, value: string) => {
                      if (!value || isValidCep(value)) return Promise.resolve();
                      return Promise.reject(new Error('CEP inválido'));
                    }
                  }] : [])
                ]}
                style={{ marginBottom: 0 }}
              >
                {showCepInput ? (
                  <ELInput
                    placeholder="00000-000"
                    size="small"
                    maxLength={9}
                    onChange={(e) => {
                      const masked = maskCep(e.target.value);
                      form.setFieldsValue({ originCep: masked });
                    }}
                  />
                ) : (
                  <ELSelect
                    placeholder="Selecione o endereço"
                    options={addressOptions}
                    loading={addressesQuery.isLoading}
                    size="small"
                    showSearch
                    optionFilterProp="label"
                    style={{ fontSize: '12px' }}
                  />
                )}
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>CEP Destino</Text>}
                name="destCep"
                rules={[
                  { required: true, message: 'Obrigatório' },
                  {
                    validator: (_: unknown, value: string) => {
                      if (!value || isValidCep(value)) return Promise.resolve();
                      return Promise.reject(new Error('CEP inválido'));
                    }
                  }
                ]}
                style={{ marginBottom: 0 }}
              >
                <ELInput
                  placeholder="00000-000"
                  size="small"
                  maxLength={9}
                  onChange={(e) => {
                    const masked = maskCep(e.target.value);
                    form.setFieldsValue({ destCep: masked });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={12} sm={12} md={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Peso (kg)</Text>}
                name="weight"
                rules={[{ required: true, message: 'Obrigatório' }]}
                style={{ marginBottom: 0 }}
              >
                <ELInput type="number" placeholder="0.5" size="small" step="0.1" style={{ minWidth: 70 }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Altura</Text>}
                name="height"
                style={{ marginBottom: 0 }}
              >
                <ELInput type="number" placeholder="cm" size="small" style={{ minWidth: 70 }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Largura</Text>}
                name="width"
                style={{ marginBottom: 0 }}
              >
                <ELInput type="number" placeholder="cm" size="small" style={{ minWidth: 70 }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Comp.</Text>}
                name="length"
                style={{ marginBottom: 0 }}
              >
                <ELInput type="number" placeholder="cm" size="small" style={{ minWidth: 70 }} />
              </Form.Item>
            </Col>
          </Row>

          <ELButton
            variant="primary"
            htmlType="submit"
            loading={quoteMutation.isPending}
            icon={<CalculatorOutlined />}
            block
            size="small"
            style={{ marginTop: 12 }}
          >
            Calcular
          </ELButton>
        </Form>
      </ELCard>

      <ELModal
        title="Opções de Envio"
        open={quoteMutation.isSuccess}
        onCancel={() => quoteMutation.reset()}
        footer={null}
        width={500}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {(quoteMutation.data || []).length === 0 ? (
            <ELAlert
              variant="warning"
              title="Nenhuma opção disponível"
              description="Não foram encontradas opções de frete para este trecho."
            />
          ) : (
            (quoteMutation.data || []).map((result, index) => (
              <ELCard key={index} size="small" padding="sm">
                <Flex justify="space-between" align="center">
                  <Space orientation="vertical" size={0}>
                    <Text strong>{result.carrier}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {result.service} • {result.deliveryDays} {result.deliveryDays === 1 ? 'dia' : 'dias'}
                    </Text>
                  </Space>
                  <Space orientation="vertical" size={4} align="end">
                    <ELTag color="blue" style={{ margin: 0 }}>
                      {formatBRL(result.price)}
                    </ELTag>
                    <ELButton
                      variant="link"
                      size="small"
                      icon={<ArrowRightOutlined />}
                      onClick={handleGoToQuote}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      Cotação
                    </ELButton>
                  </Space>
                </Flex>
              </ELCard>
            ))
          )}
        </Space>
      </ELModal>

      <ELModal
        title="Erro na Cotação"
        open={quoteMutation.isError}
        onCancel={() => quoteMutation.reset()}
        footer={
          <ELButton variant="primary" onClick={() => quoteMutation.reset()}>
            Fechar
          </ELButton>
        }
        width={400}
      >
        <ELAlert
          variant="danger"
          title="Não foi possível calcular o frete"
          description={
            quoteMutation.error instanceof Error
              ? quoteMutation.error.message
              : 'Tente novamente ou acesse a página de cotações para mais opções.'
          }
        />
      </ELModal>
    </>
  );
}
