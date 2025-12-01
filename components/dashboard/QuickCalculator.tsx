'use client';

import { useEffect } from 'react';
import { Card, Form, Input, Button, Modal, Typography, Space, Flex, Tag, Row, Col, Select, Alert } from 'antd';
import { CalculatorOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';

const { Text } = Typography;

interface QuoteResult {
  carrier: string;
  price: number;
  deliveryDays: number;
  service: string;
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

export function QuickCalculator() {
  const [form] = Form.useForm();
  const router = useRouter();

  const addressesQuery = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: fetchUserAddresses,
    staleTime: 60_000,
  });

  const addresses = addressesQuery.data || [];
  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];

  useEffect(() => {
    if (defaultAddress) {
      const current = form.getFieldValue("originCep");
      if (!current) {
        form.setFieldsValue({ originCep: defaultAddress.cep });
      }
    }
  }, [defaultAddress, form]);

  const addressOptions = addresses.map((addr) => ({
    label: `${addr.label} (${addr.cidade}/${addr.uf})`,
    value: addr.cep,
  }));

  const hasNoAddresses = !addressesQuery.isLoading && addresses.length === 0;

  const quoteMutation = useMutation({
    mutationFn: async (values: { originCep: string; destCep: string; weight: number; height?: number; width?: number; length?: number }) => {
      // Mock results - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockResults: QuoteResult[] = [
        { carrier: 'Correios', price: 25.50, deliveryDays: 5, service: 'PAC' },
        { carrier: 'Jadlog', price: 32.00, deliveryDays: 3, service: 'Expresso' },
        { carrier: 'Loggi', price: 45.00, deliveryDays: 1, service: 'Same Day' },
      ];
      return mockResults;
    },
  });

  const handleGoToQuote = () => {
    quoteMutation.reset();
    router.push('/cotacoes');
  };

  return (
    <>
      <Card
        title={
          <Flex align="center" gap={8}>
            <CalculatorOutlined />
            <Text strong>Calculadora</Text>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>(cotação rápida)</Text>
          </Flex>
        }
        variant="outlined"
        size="small"
        styles={{ body: { padding: '12px 16px' } }}
      >
        {hasNoAddresses ? (
          <Alert
            message="Nenhum endereço cadastrado"
            description={
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => router.push("/minha-conta?tab=enderecos")}
              >
                Cadastrar em Minha Conta → Endereços
              </Button>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={(values) => quoteMutation.mutate(values)}
        >
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>CEP Origem</Text>}
                name="originCep"
                rules={[{ required: true, message: 'Selecione o endereço' }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="Selecione o endereço"
                  options={addressOptions}
                  loading={addressesQuery.isLoading}
                  disabled={hasNoAddresses}
                  size="small"
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>CEP Destino</Text>}
                name="destCep"
                rules={[{ required: true, message: 'Obrigatório' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="00000-000" size="small" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={12} sm={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Peso (kg)</Text>}
                name="weight"
                rules={[{ required: true, message: 'Obrigatório' }]}
                style={{ marginBottom: 0 }}
              >
                <Input type="number" placeholder="0.5" size="small" step="0.1" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Altura</Text>}
                name="height"
                style={{ marginBottom: 0 }}
              >
                <Input type="number" placeholder="cm" size="small" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Largura</Text>}
                name="width"
                style={{ marginBottom: 0 }}
              >
                <Input type="number" placeholder="cm" size="small" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Comp.</Text>}
                name="length"
                style={{ marginBottom: 0 }}
              >
                <Input type="number" placeholder="cm" size="small" />
              </Form.Item>
            </Col>
          </Row>

          <Button
            type="primary"
            htmlType="submit"
            loading={quoteMutation.isPending}
            disabled={hasNoAddresses}
            icon={<CalculatorOutlined />}
            block
            size="small"
            style={{ marginTop: 12 }}
          >
            Calcular
          </Button>
        </Form>
      </Card>

      <Modal
        title="Opções de Envio"
        open={quoteMutation.isSuccess}
        onCancel={() => quoteMutation.reset()}
        footer={null}
        width={500}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {(quoteMutation.data || []).map((result, index) => (
            <Card key={index} size="small" variant="outlined">
              <Flex justify="space-between" align="center">
                <Space direction="vertical" size={0}>
                  <Text strong>{result.carrier}</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {result.service} • {result.deliveryDays} {result.deliveryDays === 1 ? 'dia' : 'dias'}
                  </Text>
                </Space>
                <Space direction="vertical" size={4} align="end">
                  <Tag color="blue" style={{ margin: 0 }}>
                    R$ {result.price.toFixed(2)}
                  </Tag>
                  <Button
                    type="link"
                    size="small"
                    icon={<ArrowRightOutlined />}
                    onClick={handleGoToQuote}
                    style={{ padding: 0, height: 'auto' }}
                  >
                    Cotação
                  </Button>
                </Space>
              </Flex>
            </Card>
          ))}
        </Space>
      </Modal>
    </>
  );
}
