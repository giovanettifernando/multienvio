'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, Modal, Typography, Space, Flex, Tag } from 'antd';
import { CalculatorOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Text } = Typography;

interface QuoteResult {
  carrier: string;
  price: number;
  deliveryDays: number;
  service: string;
}

export function QuickCalculator() {
  const [form] = Form.useForm();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<QuoteResult[]>([]);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      // Mock results - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockResults: QuoteResult[] = [
        { carrier: 'Correios', price: 25.50, deliveryDays: 5, service: 'PAC' },
        { carrier: 'Jadlog', price: 32.00, deliveryDays: 3, service: 'Expresso' },
        { carrier: 'Loggi', price: 45.00, deliveryDays: 1, service: 'Same Day' },
      ];
      setResults(mockResults);
      setModalOpen(true);
    } catch (error) {
      console.error('Error calculating quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLabel = (result: QuoteResult) => {
    setModalOpen(false);
    router.push(`/etiquetas/nova?carrier=${result.carrier}&service=${result.service}`);
  };

  return (
    <>
      <Card
        title={
          <Flex align="center" gap={8}>
            <CalculatorOutlined />
            <Text strong>Calculadora</Text>
          </Flex>
        }
        variant="outlined"
        size="small"
      >
        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={handleCalculate}
          style={{ fontSize: '13px' }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Form.Item
              label={<Text style={{ fontSize: '12px' }}>CEP Origem</Text>}
              name="originCep"
              initialValue="01310-100"
              style={{ marginBottom: 8 }}
            >
              <Input placeholder="00000-000" size="small" />
            </Form.Item>

            <Form.Item
              label={<Text style={{ fontSize: '12px' }}>CEP Destino</Text>}
              name="destCep"
              rules={[{ required: true, message: 'Obrigatório' }]}
              style={{ marginBottom: 8 }}
            >
              <Input placeholder="00000-000" size="small" />
            </Form.Item>

            <Flex gap={8}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Peso (kg)</Text>}
                name="weight"
                rules={[{ required: true, message: 'Obrigatório' }]}
                style={{ marginBottom: 8, flex: 1 }}
              >
                <Input type="number" placeholder="1.5" size="small" step="0.1" />
              </Form.Item>

              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Altura (cm)</Text>}
                name="height"
                style={{ marginBottom: 8, flex: 1 }}
              >
                <Input type="number" placeholder="10" size="small" />
              </Form.Item>
            </Flex>

            <Flex gap={8}>
              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Largura (cm)</Text>}
                name="width"
                style={{ marginBottom: 8, flex: 1 }}
              >
                <Input type="number" placeholder="15" size="small" />
              </Form.Item>

              <Form.Item
                label={<Text style={{ fontSize: '12px' }}>Comprimento (cm)</Text>}
                name="length"
                style={{ marginBottom: 8, flex: 1 }}
              >
                <Input type="number" placeholder="20" size="small" />
              </Form.Item>
            </Flex>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<CalculatorOutlined />}
              block
              size="small"
            >
              Calcular
            </Button>
          </Space>
        </Form>
      </Card>

      <Modal
        title="Opções de Envio"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={500}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {results.map((result, index) => (
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
                    onClick={() => handleGenerateLabel(result)}
                    style={{ padding: 0, height: 'auto' }}
                  >
                    Gerar etiqueta
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
