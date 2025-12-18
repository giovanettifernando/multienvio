'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Segmented, Form, Select, Input, Row, Col, Typography, Card } from 'antd';
import { DollarOutlined, BankOutlined } from '@ant-design/icons';
import type { CollectorFormInput } from '@/modules/collectors/application/types';
import { maskCNPJ } from '@/modules/collectors/application/masks';

const { Title, Text } = Typography;

const PIX_TYPE_OPTIONS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatória' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Conta Poupança' },
];

export default function BankForm() {
  const { control, watch, setValue, clearErrors, formState: { errors } } = useFormContext<CollectorFormInput>();
  const kind = watch('bank.kind');

  const onChangeKind = (next: 'pix' | 'transfer') => {
    if (next === 'pix') {
      setValue('bank', { kind: 'pix', pixType: 'cnpj', pixKey: '' }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('bank', { kind: 'transfer', bankCode: '', branch: '', account: '', accountType: 'corrente', holderName: '', holderCnpj: '' }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('bank');
  };

  return (
    <div>
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <DollarOutlined /> Dados para Pagamento
      </Title>

      <Form.Item label="Forma de Pagamento" required>
        <Segmented
          value={kind}
          onChange={(value) => onChangeKind(value as 'pix' | 'transfer')}
          options={[
            { label: 'PIX', value: 'pix' },
            { label: 'Transferência Bancária', value: 'transfer' },
          ]}
          block
          style={{ maxWidth: 400 }}
        />
      </Form.Item>

      {kind === 'pix' ? (
        <Card
          size="small"
          style={{ marginTop: 16, background: '#fafafa' }}
          title={
            <Text strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BankOutlined /> Dados do PIX
            </Text>
          }
        >
          <Row gutter={[24, 0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label="Tipo de chave"
                required
                validateStatus={errors.bank && 'pixType' in errors.bank ? 'error' : ''}
                help={errors.bank && 'pixType' in errors.bank ? (errors.bank as Record<string, { message?: string }>).pixType?.message : undefined}
              >
                <Controller
                  name="bank.pixType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      options={PIX_TYPE_OPTIONS}
                      placeholder="Selecione o tipo"
                    />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={16}>
              <Form.Item
                label="Chave PIX"
                required
                validateStatus={errors.bank && 'pixKey' in errors.bank ? 'error' : ''}
                help={errors.bank && 'pixKey' in errors.bank ? (errors.bank as Record<string, { message?: string }>).pixKey?.message : undefined}
              >
                <Controller
                  name="bank.pixKey"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Informe a chave PIX" />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      ) : (
        <Card
          size="small"
          style={{ marginTop: 16, background: '#fafafa' }}
          title={
            <Text strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BankOutlined /> Dados Bancários
            </Text>
          }
        >
          <Row gutter={[24, 0]}>
            <Col xs={24} sm={8} md={6}>
              <Form.Item
                label="Código do Banco"
                required
                validateStatus={errors.bank && 'bankCode' in errors.bank ? 'error' : ''}
                help={errors.bank && 'bankCode' in errors.bank ? (errors.bank as Record<string, { message?: string }>).bankCode?.message : undefined}
              >
                <Controller
                  name="bank.bankCode"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="341" maxLength={3} />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={12} sm={8} md={6}>
              <Form.Item
                label="Agência"
                required
                validateStatus={errors.bank && 'branch' in errors.bank ? 'error' : ''}
                help={errors.bank && 'branch' in errors.bank ? (errors.bank as Record<string, { message?: string }>).branch?.message : undefined}
              >
                <Controller
                  name="bank.branch"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="0001" maxLength={5} />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={12} sm={8} md={6}>
              <Form.Item
                label="Conta"
                required
                validateStatus={errors.bank && 'account' in errors.bank ? 'error' : ''}
                help={errors.bank && 'account' in errors.bank ? (errors.bank as Record<string, { message?: string }>).account?.message : undefined}
              >
                <Controller
                  name="bank.account"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="123456-7" />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={8} md={6}>
              <Form.Item
                label="Tipo de conta"
                required
                validateStatus={errors.bank && 'accountType' in errors.bank ? 'error' : ''}
                help={errors.bank && 'accountType' in errors.bank ? (errors.bank as Record<string, { message?: string }>).accountType?.message : undefined}
              >
                <Controller
                  name="bank.accountType"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} options={ACCOUNT_TYPE_OPTIONS} placeholder="Selecione" />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[24, 0]}>
            <Col xs={24} md={14}>
              <Form.Item
                label="Nome do Titular (Razão Social)"
                required
                validateStatus={errors.bank && 'holderName' in errors.bank ? 'error' : ''}
                help={errors.bank && 'holderName' in errors.bank ? (errors.bank as Record<string, { message?: string }>).holderName?.message : undefined}
              >
                <Controller
                  name="bank.holderName"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Nome completo ou razão social" />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={10}>
              <Form.Item
                label="CNPJ do Titular"
                required
                validateStatus={errors.bank && 'holderCnpj' in errors.bank ? 'error' : ''}
                help={errors.bank && 'holderCnpj' in errors.bank ? (errors.bank as Record<string, { message?: string }>).holderCnpj?.message : undefined}
              >
                <Controller
                  name="bank.holderCnpj"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
}
