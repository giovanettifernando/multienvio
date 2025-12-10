'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Segmented, Form, Input, InputNumber, Select, Space, Typography } from 'antd';
import type { CollectorFormInput } from '@/lib/collectors/types';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/lib/utils/format';

const { Title } = Typography;

export default function FinanceForm() {
  const { control, watch, setValue, clearErrors, formState: { errors } } = useFormContext<CollectorFormInput>();

  const commissionKind = watch('commission.kind');
  const bankKind = watch('bank.kind');

  const commissionLabel = commissionKind === 'fixa' ? 'Valor por coleta (R$)' : 'Valor por km (R$)';
  const commissionPlaceholder = commissionKind === 'fixa' ? 'R$ 7,50 por coleta' : 'R$ 1,20 por km';

  const handleCommissionKindChange = (value: 'fixa' | 'porKm') => {
    if (value === 'fixa') {
      setValue('commission', { kind: 'fixa', amount: 0 }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('commission', { kind: 'porKm', amountPerKm: 0 }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('commission');
  };

  const handleBankKindChange = (value: 'pix' | 'transfer') => {
    if (value === 'pix') {
      setValue('bank', { kind: 'pix', pixType: 'cnpj', pixKey: '' }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('bank', { kind: 'transfer', bankCode: '', branch: '', account: '', accountType: 'corrente', holderName: '', holderCnpj: '' }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('bank');
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={24}>
      {/* Seção de Comissão */}
      <div>
        <Title level={5}>Modelo de Comissão</Title>
        <Form.Item label="Tipo de comissão" required>
          <Segmented
            value={commissionKind}
            onChange={(value) => handleCommissionKindChange(value as 'fixa' | 'porKm')}
            options={[
              { label: 'Valor fixo por coleta', value: 'fixa' },
              { label: 'Valor por quilômetro', value: 'porKm' },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={commissionLabel}
          required
          validateStatus={errors.commission ? 'error' : ''}
          help={errors.commission?.message || 'Informe o valor recebido pelo coletor conforme o modelo selecionado.'}
        >
          {commissionKind === 'fixa' ? (
            <Controller
              name="commission.amount"
              control={control}
              render={({ field }) => (
                <InputNumber
                  {...field}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="R$"
                  decimalSeparator=","
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                  placeholder={commissionPlaceholder}
                  style={{ width: 220 }}
                />
              )}
            />
          ) : (
            <Controller
              name="commission.amountPerKm"
              control={control}
              render={({ field }) => (
                <InputNumber
                  {...field}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="R$"
                  decimalSeparator=","
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                  placeholder={commissionPlaceholder}
                  style={{ width: 220 }}
                />
              )}
            />
          )}
        </Form.Item>
      </div>

      {/* Seção de Pagamento */}
      <div>
        <Title level={5}>Forma de Pagamento</Title>
        <Form.Item label="Método de pagamento" required>
          <Segmented
            value={bankKind}
            onChange={(value) => handleBankKindChange(value as 'pix' | 'transfer')}
            options={[
              { label: 'PIX', value: 'pix' },
              { label: 'Transferência bancária', value: 'transfer' },
            ]}
          />
        </Form.Item>

        {bankKind === 'pix' ? (
          <>
            <Form.Item
              label="Tipo de chave PIX"
              required
              validateStatus={errors.bank ? 'error' : ''}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.pixType"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    style={{ width: 200 }}
                    options={[
                      { label: 'CPF', value: 'cpf' },
                      { label: 'CNPJ', value: 'cnpj' },
                      { label: 'E-mail', value: 'email' },
                      { label: 'Telefone', value: 'phone' },
                      { label: 'Chave aleatória', value: 'random' },
                    ]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Chave PIX"
              required
              validateStatus={errors.bank ? 'error' : ''}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.pixKey"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Informe a chave PIX" style={{ width: 300 }} />
                )}
              />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              label="Código do banco"
              required
              validateStatus={errors.bank ? 'error' : ''}
              help={errors.bank?.message || 'Ex: 001, 237, 104'}
            >
              <Controller
                name="bank.bankCode"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="000" maxLength={3} style={{ width: 120 }} />
                )}
              />
            </Form.Item>

            <Space size={12}>
              <Form.Item
                label="Agência"
                required
                validateStatus={errors.bank ? 'error' : ''}
                help={errors.bank?.message}
              >
                <Controller
                  name="bank.branch"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="0000" style={{ width: 120 }} />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Conta"
                required
                validateStatus={errors.bank ? 'error' : ''}
                help={errors.bank?.message}
              >
                <Controller
                  name="bank.account"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="12345-6" style={{ width: 150 }} />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Tipo"
                required
                validateStatus={errors.bank ? 'error' : ''}
                help={errors.bank?.message}
              >
                <Controller
                  name="bank.accountType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      style={{ width: 140 }}
                      options={[
                        { label: 'Corrente', value: 'corrente' },
                        { label: 'Poupança', value: 'poupanca' },
                      ]}
                    />
                  )}
                />
              </Form.Item>
            </Space>

            <Form.Item
              label="Titular (Razão Social)"
              required
              validateStatus={errors.bank ? 'error' : ''}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.holderName"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Razão social da empresa" />
                )}
              />
            </Form.Item>

            <Form.Item
              label="CNPJ do titular"
              required
              validateStatus={errors.bank ? 'error' : ''}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.holderCnpj"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="00.000.000/0000-00" style={{ width: 220 }} />
                )}
              />
            </Form.Item>
          </>
        )}
      </div>
    </Space>
  );
}
