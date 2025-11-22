'use client';

import { Card, Descriptions, Button, Modal, Form, Input, InputNumber, Select, App } from 'antd';
import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';

// Mock aggregated fees data
const mockFees = [
  { method: 'Cartão', type: 'MDR', quantity: 150, total: 4500.0, avg: 30.0 },
  { method: 'Boleto', type: 'Taxa', quantity: 45, total: 157.5, avg: 3.5 },
  { method: 'PIX', type: 'Taxa', quantity: 320, total: 0.0, avg: 0.0 },
  { method: 'Plataforma', type: 'Mensalidade', quantity: 85, total: 1275.0, avg: 15.0 },
];

export function FeesView() {
  const { message } = App.useApp();
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentForm] = Form.useForm();

  const handleCreateAdjustment = () => {
    adjustmentForm
      .validateFields()
      .then(() => {
        message.success('Ajuste de taxa criado com sucesso');
        setAdjustmentModalOpen(false);
        adjustmentForm.resetFields();
      })
      .catch(() => {
        message.error('Por favor, preencha todos os campos obrigatórios');
      });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Taxas Cobradas no Período</h3>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdjustmentModalOpen(true)}>
            Ajuste Manual
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {mockFees.map((fee, idx) => (
            <Card key={idx} size="small" title={`${fee.method} - ${fee.type}`}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Quantidade">{fee.quantity}</Descriptions.Item>
                <Descriptions.Item label="Total">
                  {fee.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Descriptions.Item>
                <Descriptions.Item label="Média">
                  {fee.avg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ))}
        </div>

        <Card size="small" title="Total Geral">
          <Descriptions column={2}>
            <Descriptions.Item label="Operações">
              {mockFees.reduce((sum, f) => sum + f.quantity, 0)}
            </Descriptions.Item>
            <Descriptions.Item label="Valor Total">
              {mockFees
                .reduce((sum, f) => sum + f.total, 0)
                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Modal
        title="Ajuste Manual de Taxa"
        open={adjustmentModalOpen}
        onOk={handleCreateAdjustment}
        onCancel={() => {
          setAdjustmentModalOpen(false);
          adjustmentForm.resetFields();
        }}
      >
        <Form form={adjustmentForm} layout="vertical">
          <Form.Item name="customerId" label="ID do Cliente" rules={[{ required: true }]}>
            <Input placeholder="cli_001" />
          </Form.Item>
          <Form.Item name="customerName" label="Nome do Cliente" rules={[{ required: true }]}>
            <Input placeholder="Nome ou Razão Social" />
          </Form.Item>
          <Form.Item name="feeType" label="Tipo de Taxa" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'MDR Cartão', value: 'mdr' },
                { label: 'Taxa Boleto', value: 'boleto' },
                { label: 'Taxa Plataforma', value: 'platform' },
              ]}
            />
          </Form.Item>
          <Form.Item name="amount" label="Valor (R$)" rules={[{ required: true }]}>
            <InputNumber
              min={0}
              step={0.01}
              style={{ width: '100%' }}
              formatter={(value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value) => Number(value?.replace(/R\$\s?|(\.)/g, '').replace(',', '.') || 0) as 0}
            />
          </Form.Item>
          <Form.Item name="description" label="Descrição">
            <Input.TextArea rows={2} placeholder="Motivo do ajuste..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
